import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { QrScanner } from "@yudiel/react-qr-scanner";
import AdminFake404 from "@/components/AdminFake404";
import { Shield, QrCode, Loader2, BookOpen, FileText, Upload } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// Simple token gate using a shared moderator token stored in sessionStorage
function useAdminToken() {
	const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("shadowmesh_admin_token"));
	const save = (t: string) => {
		sessionStorage.setItem("shadowmesh_admin_token", t);
		setToken(t);
	};
	const clear = () => {
		sessionStorage.removeItem("shadowmesh_admin_token");
		setToken(null);
	};
	return { token, save, clear };
}

function formatDate(iso?: string | null) {
	if (!iso) return "-";
	try {
		const d = new Date(iso);
		return d.toLocaleString();
	} catch {
		return iso as string;
	}
}

// Client-side TOTP verification (RFC 6238 compliant) - same as AdminFake404
async function verifyTOTPClient(secret: string, code: string): Promise<boolean> {
	// CRITICAL: Always return false if code is invalid format
	if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
		console.error("Invalid code format:", code);
		return false;
	}

	if (!secret || secret.length < 16) {
		console.error("Invalid secret length:", secret?.length);
		return false;
	}

	try {
		// Base32 decode with proper error handling
		const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
		let bits = 0;
		let value = 0;
		const output: number[] = [];
		
		// Remove padding and uppercase
		const cleanSecret = secret.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
		
		if (cleanSecret.length === 0) {
			console.error("Secret is empty after cleaning");
			return false;
		}
		
		for (let i = 0; i < cleanSecret.length; i++) {
			const charIndex = base32chars.indexOf(cleanSecret[i]);
			if (charIndex === -1) {
				console.error("Invalid base32 character in secret at position", i, ":", cleanSecret[i]);
				return false;
			}
			value = (value << 5) | charIndex;
			bits += 5;
			if (bits >= 8) {
				output.push((value >>> (bits - 8)) & 255);
				bits -= 8;
			}
		}
		
		if (output.length === 0) {
			console.error("Invalid secret: empty after decoding");
			return false;
		}
		
		const key = new Uint8Array(output);
		const timeStep = 30;
		const now = Math.floor(Date.now() / 1000 / timeStep);
		
		// Check current time step and adjacent windows (for clock skew)
		for (let i = -1; i <= 1; i++) {
			const testTime = now + i;
			const testCounter = new Uint8Array(8);
			let tempTime = testTime;
			
			// Convert time to 8-byte big-endian counter
			for (let j = 7; j >= 0; j--) {
				testCounter[j] = tempTime & 0xff;
				tempTime >>>= 8;
			}
			
			// HMAC-SHA1
			const cryptoKey = await crypto.subtle.importKey(
				"raw",
				key,
				{ name: "HMAC", hash: "SHA-1" },
				false,
				["sign"]
			);
			
			const signature = await crypto.subtle.sign("HMAC", cryptoKey, testCounter);
			const sigArray = new Uint8Array(signature);
			
			// Dynamic truncation (RFC 4226)
			const offset = sigArray[19] & 0x0f;
			const testCode = ((sigArray[offset] & 0x7f) << 24) |
							 ((sigArray[offset + 1] & 0xff) << 16) |
							 ((sigArray[offset + 2] & 0xff) << 8) |
							 (sigArray[offset + 3] & 0xff);
			
			const testCodeStr = (testCode % 1000000).toString().padStart(6, "0");
			
			if (testCodeStr === code) {
				console.log("TOTP match found for time window:", i);
				return true;
			}
		}
		
		console.log("No TOTP match found for code:", code);
		return false;
	} catch (error) {
		console.error("TOTP verification error:", error);
		return false;
	}
}

function parseScanPayload(raw: string): { eventId?: string | null; code?: string | null } {
	if (!raw) return { eventId: null, code: null };
	const trimmed = raw.trim();
	let eventId: string | null | undefined;
	let code: string | null | undefined;

	// Try JSON payload
	try {
		const parsed = JSON.parse(trimmed);
		if (typeof parsed === "object" && parsed) {
			eventId = parsed.event_id ?? parsed.eventId ?? eventId;
			code = parsed.code ?? parsed.secret_code ?? parsed.secretCode ?? code;
		}
	} catch {}

	// Try query-string style
	if (!eventId || !code) {
		const queryString = trimmed.includes("?") ? trimmed.split("?")[1] : trimmed;
		try {
			const params = new URLSearchParams(queryString);
			eventId = eventId ?? params.get("event_id") ?? params.get("eventId") ?? params.get("event") ?? undefined;
			code = code ?? params.get("member_id") ?? params.get("memberId") ?? params.get("id") ?? undefined;
		} catch {
			// ignore
		}
	}

	// Try delimiter-based (event|code)
	if ((!eventId || !code) && trimmed.includes("|")) {
		const [maybeEvent, maybeCode] = trimmed.split("|").map((part) => part.trim());
		eventId = eventId ?? maybeEvent;
		code = code ?? maybeCode;
	}

	return { eventId: eventId ?? null, code: code ?? null };
}

type CheckInOutcome = { status: string; message: string };

type JoinRow = {
	id: string;
	created_at: string;
	status: string;
	full_name: string;
	email: string;
	affiliation: string;
	area_of_interest: string | null;
	university_name: string | null;
	department: string | null;
	roll_number: string | null;
	organization: string | null;
	role_title: string | null;
	phone_e164: string | null;
	raw_phone: string | null;
	verification_token: string | null;
	secret_code: string | null;
	reviewed_at: string | null;
	reviewed_by: string | null;
	decision_reason: string | null;
};

type MessageRow = {
	id: string;
	created_at: string;
	name: string;
	email: string;
	message: string;
	phone_e164: string | null;
	raw_phone: string | null;
	source_page: string | null;
	user_agent: string | null;
};

const PAGE_SIZE = 50;

const Admin = () => {
	const { toast } = useToast();
	const { token, save, clear } = useAdminToken();

    // Basic username/password gate (client-side only)
    const [authed, setAuthed] = useState<boolean>(() => {
        const auth = sessionStorage.getItem("shadowmesh_admin_basic_auth");
        const authTime = sessionStorage.getItem("shadowmesh_admin_authenticated_at");
        if (auth === "1" && authTime) {
            // Check if session is still valid (8 hours)
            const authTimestamp = parseInt(authTime, 10);
            const now = Date.now();
            if (now - authTimestamp < 8 * 60 * 60 * 1000) {
                return true;
            } else {
                // Session expired
                sessionStorage.removeItem("shadowmesh_admin_basic_auth");
                sessionStorage.removeItem("shadowmesh_admin_authenticated_at");
            }
        }
        return false;
    });

    // 2FA state
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
    const [twoFactorQRCode, setTwoFactorQRCode] = useState<string | null>(null);
    const [twoFactorCode, setTwoFactorCode] = useState("");
    const [twoFactorVerifying, setTwoFactorVerifying] = useState(false);
    const [twoFactorSetupMode, setTwoFactorSetupMode] = useState(false);

	// Tabs
	const [tab, setTab] = useState("applications");
	const [appStatusTab, setAppStatusTab] = useState("pending");

	// Filters/search
	const [search, setSearch] = useState("");
	const [eventsFilter, setEventsFilter] = useState<string>("all");
	const [hackathonsFilter, setHackathonsFilter] = useState<string>("all");
	
	// Loading states for actions
	const [moderatingId, setModeratingId] = useState<string | null>(null);
	const [savingEvent, setSavingEvent] = useState(false);
	const [moderatingHackathonId, setModeratingHackathonId] = useState<string | null>(null);

	// Data state - separate for each status
	const [appsPending, setAppsPending] = useState<JoinRow[]>([]);
	const [appsApproved, setAppsApproved] = useState<JoinRow[]>([]);
	const [appsRejected, setAppsRejected] = useState<JoinRow[]>([]);
	const [appsHasMore, setAppsHasMore] = useState(true);
	const [appsLoading, setAppsLoading] = useState(false);

	const [msgs, setMsgs] = useState<MessageRow[]>([]);
	const [msgsHasMore, setMsgsHasMore] = useState(true);
	const [msgsLoading, setMsgsLoading] = useState(false);

	const [members, setMembers] = useState<any[]>([]);
	const [membersHasMore, setMembersHasMore] = useState(true);
	const [membersLoading, setMembersLoading] = useState(false);

	const [hackathonRegs, setHackathonRegs] = useState<any[]>([]);
	const [hackRegsHasMore, setHackRegsHasMore] = useState(true);
	const [hackRegsLoading, setHackRegsLoading] = useState(false);
	const [feedbacks, setFeedbacks] = useState<any[]>([]);
	const [feedbacksLoading, setFeedbacksLoading] = useState(false);
	const [feedbacksHasMore, setFeedbacksHasMore] = useState(true);

const [events, setEvents] = useState<any[]>([]);
const [eventsLoading, setEventsLoading] = useState(false);
const [attendanceEventId, setAttendanceEventId] = useState<string | null>(null);
const [attendanceData, setAttendanceData] = useState<any>(null);
const [showEventForm, setShowEventForm] = useState(false);
const [editingEvent, setEditingEvent] = useState<any | null>(null);
// Hackathon management
const [selectedHackathon, setSelectedHackathon] = useState<any | null>(null);
const [showHackathonManage, setShowHackathonManage] = useState(false);
const [showAddResource, setShowAddResource] = useState(false);
const [showSubmissionConfig, setShowSubmissionConfig] = useState(false);
const [resourceTitle, setResourceTitle] = useState("");
const [resourceUrl, setResourceUrl] = useState("");
const [resourceDescription, setResourceDescription] = useState("");
const [hackathonResources, setHackathonResources] = useState<any[]>([]);
const [submissionPageEnabled, setSubmissionPageEnabled] = useState(false);
const [submissionFields, setSubmissionFields] = useState<any>(null);
const [eventFormData, setEventFormData] = useState({
	title: "",
	description: "",
	event_type: "workshop",
	start_date: "",
	end_date: "",
	location: "",
	registration_link: "",
	max_participants: "",
	fee_amount: "0",
	fee_currency: "PKR",
	payment_required: false,
	notify_members: false,
	category: "none",
	tags: "",
	image_url: "",
	registration_deadline: "",
	status: "upcoming",
	is_active: true,
	is_member_only: true,
});
const [attendanceLoading, setAttendanceLoading] = useState(false);
const [checkinCode, setCheckinCode] = useState("");
const [checkinLoading, setCheckinLoading] = useState(false);
const [scannerOpen, setScannerOpen] = useState(false);
const [scannerPaused, setScannerPaused] = useState(false);
const [checkinResult, setCheckinResult] = useState<string | null>(null);
const scannerLockRef = useRef(false);

	const [memberDetails, setMemberDetails] = useState<any>(null);
	const [showMemberDetails, setShowMemberDetails] = useState(false);
	const [deleteMemberOpen, setDeleteMemberOpen] = useState(false);
	const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);
	const [deleteMemberReason, setDeleteMemberReason] = useState("");

	// Detail dialog
	const [openDetail, setOpenDetail] = useState(false);
	const [detail, setDetail] = useState<JoinRow | null>(null);
	const [rejectOpen, setRejectOpen] = useState(false);
	const [rejectReason, setRejectReason] = useState("");
	const [rejectingId, setRejectingId] = useState<string | null>(null);
	const [hackRejectOpen, setHackRejectOpen] = useState(false);
	const [hackRejectReason, setHackRejectReason] = useState("");
	const [hackRejectingId, setHackRejectingId] = useState<string | null>(null);
	const [paymentProofViewer, setPaymentProofViewer] = useState<string | null>(null);
	const [viewingHackathonReg, setViewingHackathonReg] = useState<any | null>(null);

	// Initial loads
    useEffect(() => {
        if (!authed || !token) return;
        void loadApps("pending", true);
        void loadApps("approved", true);
        void loadApps("rejected", true);
									void loadMsgs(true);
									void loadMembers(true);
									void loadHackathonRegs(true);
                                void loadEvents(true);
								if (tab === "feedback") void loadFeedbacks(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authed, token]);

	// Load feedbacks when tab changes to feedback
	useEffect(() => {
		if (tab === "feedback" && authed) {
			void loadFeedbacks(true);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tab, authed]);

    useEffect(() => {
        if (!authed || !token) return;
        if (!attendanceEventId) {
            setAttendanceData(null);
            return;
        }
        void loadAttendance(attendanceEventId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authed, token, attendanceEventId]);

    async function loadApps(statusFilter: "pending" | "approved" | "rejected", reset = false) {
        if (!authed || !token || appsLoading) return;
		setAppsLoading(true);
		try {
			const currentList = statusFilter === "pending" ? appsPending : statusFilter === "approved" ? appsApproved : appsRejected;
			const page = reset ? 0 : Math.floor(currentList.length / PAGE_SIZE);
			const res = await fetch(`${SUPABASE_URL}/functions/v1/admin_list`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-admin-token": token,
					"Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
				},
				body: JSON.stringify({
					type: "applications",
					status: statusFilter,
					search: search.trim() || undefined,
					page,
					pageSize: PAGE_SIZE,
				}),
			});
			if (!res.ok) throw new Error(await res.text());
			const { data, hasMore } = await res.json();
			const setter = statusFilter === "pending" ? setAppsPending : statusFilter === "approved" ? setAppsApproved : setAppsRejected;
			setter((prev) => (reset ? data ?? [] : [...prev, ...(data ?? [])]));
			setAppsHasMore(hasMore);
		} catch (e: any) {
			toast({ title: "Failed to load applications", description: e.message || String(e) });
		} finally {
			setAppsLoading(false);
		}
	}

    async function loadMsgs(reset = false) {
        if (!authed || !token || msgsLoading) return;
		setMsgsLoading(true);
		try {
			const page = reset ? 0 : Math.floor(msgs.length / PAGE_SIZE);
			const res = await fetch(`${SUPABASE_URL}/functions/v1/admin_list`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-admin-token": token,
					"Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
				},
				body: JSON.stringify({
					type: "messages",
					search: search.trim() || undefined,
					page,
					pageSize: PAGE_SIZE,
				}),
			});
			if (!res.ok) throw new Error(await res.text());
			const { data, hasMore } = await res.json();
			setMsgs((prev) => (reset ? data ?? [] : [...prev, ...(data ?? [])]));
			setMsgsHasMore(hasMore);
		} catch (e: any) {
			toast({ title: "Failed to load messages", description: e.message || String(e) });
		} finally {
			setMsgsLoading(false);
		}
	}

	async function loadMembers(reset = false) {
        if (!authed || !token || membersLoading) return;
		setMembersLoading(true);
		try {
			const page = reset ? 0 : Math.floor(members.length / PAGE_SIZE);
			const res = await fetch(`${SUPABASE_URL}/functions/v1/admin_list`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-admin-token": token,
					"Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
				},
				body: JSON.stringify({
					type: "members",
					search: search.trim() || undefined,
					page,
					pageSize: PAGE_SIZE,
				}),
			});
			if (!res.ok) throw new Error(await res.text());
			const { data, hasMore } = await res.json();
			setMembers((prev) => (reset ? data ?? [] : [...prev, ...(data ?? [])]));
			setMembersHasMore(hasMore);
		} catch (e: any) {
			toast({ title: "Failed to load members", description: e.message || String(e) });
		} finally {
			setMembersLoading(false);
		}
	}

	async function loadHackathonRegs(reset = false) {
        if (!authed || !token || hackRegsLoading) return;
		setHackRegsLoading(true);
		try {
			const page = reset ? 0 : Math.floor(hackathonRegs.length / PAGE_SIZE);
			const res = await fetch(`${SUPABASE_URL}/functions/v1/admin_list`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-admin-token": token,
					"Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
				},
				body: JSON.stringify({
					type: "hackathon_registrations",
					status: hackathonsFilter !== "all" ? hackathonsFilter : undefined,
					search: search.trim() || undefined,
					page,
					pageSize: PAGE_SIZE,
				}),
			});
			if (!res.ok) throw new Error(await res.text());
			const { data, hasMore } = await res.json();
			setHackathonRegs((prev) => (reset ? data ?? [] : [...prev, ...(data ?? [])]));
			setHackRegsHasMore(hasMore);
		} catch (e: any) {
			toast({ title: "Failed to load hackathon registrations", description: e.message || String(e) });
		} finally {
			setHackRegsLoading(false);
		}
	}

	async function loadAttendance(eventId: string, force = false) {
        if (!authed || !token) return;
        const current = eventId;
        setAttendanceLoading(true);
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/admin_list`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-token": token,
                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    type: "attendance_details",
                    event_id: eventId,
                }),
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || "Failed to load attendance");
            }
            const data = await res.json();
            if (force || attendanceEventId === current) {
                setAttendanceData(data);
            }
        } catch (e: any) {
            if (force || attendanceEventId === current) {
                toast({ title: "Failed to load attendance", description: e.message || String(e) });
            }
        } finally {
            if (force || attendanceEventId === current) {
                setAttendanceLoading(false);
            }
        }
    }

	async function loadEvents(reset = false) {
        if (!authed || !token) return;
        setEventsLoading(true);
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/admin_list`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-token": token,
                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    type: "events",
                    search: search.trim() || undefined,
                    event_type: eventsFilter !== "all" ? eventsFilter : undefined,
                }),
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || "Failed to load events");
            }
            const { data } = await res.json();
            const list = Array.isArray(data) ? data : [];
            setEvents(list);

            if (list.length === 0) {
                setAttendanceEventId(null);
                if (reset) {
                    setAttendanceData(null);
                }
                return;
            }

            const currentId = attendanceEventId;
            const containsCurrent = currentId ? list.some((evt: any) => evt.id === currentId) : false;

            if (!currentId || !containsCurrent) {
                const newId = list[0]?.id as string | undefined;
                if (newId !== currentId) {
                    setAttendanceEventId(newId ?? null);
                } else if (reset && newId) {
                    await loadAttendance(newId, true);
                }
            } else if (reset && currentId) {
                await loadAttendance(currentId, true);
            }
        } catch (e: any) {
            toast({ title: "Failed to load events", description: e.message || String(e) });
        } finally {
            setEventsLoading(false);
        }
    }

	async function performCheckIn(eventId: string, code: string, method: "qr" | "manual" = "manual") {
        if (!authed || !token) {
            return { status: "error", message: "Not authorized." };
        }

        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/admin_attendance_checkin`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-token": token,
                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    event_id: eventId,
                    code: code.trim().toUpperCase(),
                    method,
                    recorded_by: "admin-dashboard",
                }),
            });

            const text = await res.text();
            let data: any = {};
            if (text) {
                try {
                    data = JSON.parse(text);
                } catch {
                    data = { raw: text };
                }
            }

            const statusValue = data?.status ?? (res.ok ? "ok" : "error");

            if (statusValue === "checked_in") {
                await loadAttendance(eventId, true);
                const memberName = data?.member?.full_name ?? "Member";
                return { status: "checked_in", message: `${memberName} checked in successfully.` };
            }

            if (statusValue === "already_checked_in") {
                await loadAttendance(eventId, true);
                const time = data?.checkin?.created_at ? formatDate(data.checkin.created_at) : "earlier";
                return { status: "already_checked_in", message: `Already checked in (${time}).` };
            }

            if (statusValue === "not_registered") {
                return { status: "not_registered", message: "Member is not registered for this event." };
            }

            if (statusValue === "code_not_found") {
                return { status: "code_not_found", message: "No member found for that code." };
            }

            if (!res.ok) {
                const message = data?.message || data?.error || (typeof data?.raw === "string" ? data.raw : text) || "Check-in failed";
                throw new Error(message);
            }

            return { status: statusValue, message: data?.message || "Check-in response received." };
        } catch (e: any) {
            return { status: "error", message: e.message || String(e) };
        }
    }

	async function loadMemberDetails(memberId: string) {
        if (!authed || !token) return;
		try {
			const res = await fetch(`${SUPABASE_URL}/functions/v1/admin_list`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-admin-token": token,
					"Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
				},
				body: JSON.stringify({
					type: "member_details",
					member_id: memberId,
				}),
			});
			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			setMemberDetails(data);
			setShowMemberDetails(true);
		} catch (e: any) {
			toast({ title: "Failed to load member details", description: e.message || String(e) });
		}
	}

	async function handleManualCheckIn(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!attendanceEventId) {
            toast({ title: "Select event", description: "Choose an event before checking in." });
            return;
        }
        if (!checkinCode.trim()) {
            toast({ title: "Enter a code", description: "ShadowMesh code is required." });
            return;
        }
        setCheckinLoading(true);
        const outcome = await performCheckIn(attendanceEventId, checkinCode, "manual");
        setCheckinLoading(false);
        setCheckinResult(outcome.message);
        if (outcome.status === "checked_in") {
            toast({ title: "Checked in", description: outcome.message });
            setCheckinCode("");
        } else if (outcome.status === "already_checked_in") {
            toast({ title: "Already checked in", description: outcome.message });
        } else if (outcome.status === "not_registered") {
            toast({ title: "Not registered", description: outcome.message });
        } else if (outcome.status === "code_not_found") {
            toast({ title: "Code not found", description: outcome.message });
        } else if (outcome.status === "error") {
            toast({ title: "Check-in failed", description: outcome.message });
        }
    }

	async function handleScannerDecode(value: string) {
        if (!value || scannerLockRef.current) return;
        scannerLockRef.current = true;
        setScannerPaused(true);
        try {
            const { eventId, code } = parseScanPayload(value);
            if (!code) {
                setCheckinResult("QR code missing member code.");
                toast({ title: "Scan error", description: "QR code missing member code." });
                return;
            }

            let targetEventId = attendanceEventId;
            if (eventId && eventId !== attendanceEventId) {
                setAttendanceEventId(eventId);
                targetEventId = eventId;
            }

            if (!targetEventId) {
                setCheckinResult("Select an event before scanning.");
                toast({ title: "Select event", description: "Choose an event before scanning." });
                return;
            }

            const outcome = await performCheckIn(targetEventId, code, "qr");
            setCheckinResult(outcome.message);

            if (outcome.status === "checked_in") {
                toast({ title: "Checked in", description: outcome.message });
            } else if (outcome.status === "already_checked_in") {
                toast({ title: "Already checked in", description: outcome.message });
            } else if (outcome.status === "not_registered" || outcome.status === "code_not_found") {
                toast({ title: "Not registered", description: outcome.message });
            } else if (outcome.status === "error") {
                toast({ title: "Check-in failed", description: outcome.message });
            }
        } finally {
            setTimeout(() => {
                scannerLockRef.current = false;
                setScannerPaused(false);
            }, 1200);
        }
    }

	async function deleteMember() {
        if (!token || !deleteMemberId) return;
		try {
			const res = await fetch(`${SUPABASE_URL}/functions/v1/admin_delete_member`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-admin-token": token,
					"Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
				},
				body: JSON.stringify({
					member_id: deleteMemberId,
					reason: deleteMemberReason.trim() || undefined,
				}),
			});
			if (!res.ok) throw new Error(await res.text());
			toast({ title: "Member deleted", description: "Member has been deleted and notified via email." });
			setDeleteMemberOpen(false);
			setDeleteMemberId(null);
			setDeleteMemberReason("");
			void loadMembers(true);
		} catch (e: any) {
			toast({ title: "Failed to delete member", description: e.message || String(e) });
		}
	}

	const registrations = useMemo(() => attendanceData?.registrations ?? [], [attendanceData]);
	const checkins = useMemo(() => attendanceData?.checkins ?? [], [attendanceData]);
	const checkedMemberIds = useMemo(() => {
		const ids = new Set<string>();
		for (const entry of checkins) {
			if (entry?.member_id) ids.add(entry.member_id);
		}
		return ids;
	}, [checkins]);
	const totalRegistered = registrations.length;
	const totalCheckedIn = checkedMemberIds.size;
	const attendanceRate = totalRegistered ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0;

	async function moderateHackathon(id: string, action: "approve" | "reject", reason?: string) {
        if (!token) return;
		setModeratingHackathonId(id);
		try {
			const res = await fetch(`${SUPABASE_URL}/functions/v1/moderate_hackathon`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-admin-token": token,
					"Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
				},
				body: JSON.stringify({ id, action, reason }),
			});
			if (!res.ok) throw new Error(await res.text());
			toast({ title: `Hackathon registration ${action}d` });
			void loadHackathonRegs(true);
		} catch (e: any) {
			toast({ title: "Moderation failed", description: e.message || String(e), variant: "destructive" });
		} finally {
			setModeratingHackathonId(null);
		}
	}

	async function saveEvent() {
		if (!eventFormData.title.trim()) {
			toast({ title: "Title required", description: "Please enter an event title." });
			return;
		}
		if (!eventFormData.start_date || !eventFormData.start_date.trim()) {
			toast({ title: "Start date required", description: "Please select a start date and time." });
			return;
		}

		// Validate that the datetime-local value is complete (has both date and time)
		const startDateValue = eventFormData.start_date.trim();
		if (!startDateValue.includes('T') || startDateValue.split('T')[1] === '') {
			toast({ title: "Start time required", description: "Please select both date and time for the start date." });
			return;
		}

		// Validate that the date is valid
		const startDate = new Date(startDateValue);
		if (isNaN(startDate.getTime())) {
			toast({ title: "Invalid start date", description: "Please enter a valid start date and time." });
			return;
		}

		setSavingEvent(true);
		try {
			const eventData: any = {
				title: eventFormData.title.trim(),
				description: eventFormData.description.trim() || null,
				event_type: eventFormData.event_type,
				start_date: startDate.toISOString(),
				end_date: eventFormData.end_date ? new Date(eventFormData.end_date).toISOString() : null,
				location: eventFormData.location.trim() || null,
				registration_link: eventFormData.registration_link.trim() || null,
				max_participants: eventFormData.max_participants ? parseInt(eventFormData.max_participants) : null,
				fee_amount: parseFloat(eventFormData.fee_amount) || 0,
				fee_currency: eventFormData.fee_currency,
				payment_required: eventFormData.payment_required,
				notify_members: eventFormData.notify_members,
				category: eventFormData.category === "none" || !eventFormData.category.trim() ? null : eventFormData.category.trim(),
				tags: eventFormData.tags.trim() ? eventFormData.tags.split(",").map(t => t.trim()).filter(Boolean) : null,
				image_url: eventFormData.image_url.trim() || null,
				registration_deadline: eventFormData.registration_deadline ? new Date(eventFormData.registration_deadline).toISOString() : null,
				status: eventFormData.status,
				is_active: eventFormData.is_active,
				is_member_only: eventFormData.is_member_only,
				updated_at: new Date().toISOString(),
			};

			if (editingEvent) {
				// Update existing event
				const { error } = await supabase
					.from("events")
					.update(eventData)
					.eq("id", editingEvent.id);

				if (error) throw error;
				toast({ title: "Event updated", description: "The event has been updated successfully." });
			} else {
				// Create new event
				const { error } = await supabase
					.from("events")
					.insert([eventData]);

				if (error) throw error;
				toast({ title: "Event created", description: "The event has been created and is now visible in member portals." });
				
				// Send notification if requested
				if (eventFormData.notify_members) {
					try {
						await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								"Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
							},
							body: JSON.stringify({
								type: "event_announcement",
								data: {
									eventTitle: eventFormData.title,
									eventType: eventFormData.event_type,
									startDate: eventFormData.start_date,
									location: eventFormData.location,
								},
							}),
						});
					} catch (e) {
						console.warn("Notification failed:", e);
					}
				}
			}

			setShowEventForm(false);
			setEditingEvent(null);
			void loadEvents(true);
		} catch (e: any) {
			toast({ title: editingEvent ? "Update failed" : "Creation failed", description: e.message || String(e) });
		}
	}

	async function deleteEvent(id: string) {
		try {
			// First, get event type to determine if it's a hackathon
			const { data: eventData } = await supabase
				.from("events")
				.select("event_type")
				.eq("id", id)
				.single();

			// If it's a hackathon, cascade delete all related data
			if (eventData?.event_type === "hackathon") {
				// Delete hackathon resources
				await supabase
					.from("hackathon_resources")
					.delete()
					.eq("hackathon_id", id);

				// Delete hackathon submissions
				await supabase
					.from("hackathon_submissions")
					.delete()
					.eq("hackathon_id", id);

				// Delete hackathon results
				await supabase
					.from("hackathon_results")
					.delete()
					.eq("hackathon_id", id);

				// Delete hackathon invites
				await supabase
					.from("hackathon_invites")
					.delete()
					.eq("hackathon_id", id);

				// Delete team members (cascade will handle teams)
				const { data: teams } = await supabase
					.from("hackathon_teams")
					.select("id")
					.eq("hackathon_id", id);

				if (teams) {
					for (const team of teams) {
						await supabase
							.from("team_members")
							.delete()
							.eq("team_id", team.id);
						await supabase
							.from("team_requests")
							.delete()
							.eq("team_id", team.id);
					}
				}

				// Delete hackathon teams
				await supabase
					.from("hackathon_teams")
					.delete()
					.eq("hackathon_id", id);

				// Delete hackathon registrations
				await supabase
					.from("hackathon_registrations")
					.delete()
					.eq("hackathon_id", id);
			}

			// Delete event registrations
			await supabase
				.from("event_registrations")
				.delete()
				.eq("event_id", id);

			// Delete event check-ins
			await supabase
				.from("event_checkins")
				.delete()
				.eq("event_id", id);

			// Finally, delete the event itself
			const { error } = await supabase
				.from("events")
				.delete()
				.eq("id", id);

			if (error) throw error;
			toast({ title: "Event deleted", description: "The event and all related data have been deleted." });
			void loadEvents(true);
		} catch (e: any) {
			toast({ title: "Delete failed", description: e.message || String(e) });
		}
	}

	// Hackathon management functions
	async function addHackathonResource() {
		if (!selectedHackathon || !resourceTitle.trim() || !resourceUrl.trim()) {
			toast({ title: "Fields required", description: "Please enter title and URL." });
			return;
		}

		try {
			// First create the resource
			const { data: resourceData, error: resourceError } = await supabase
				.from("member_resources")
				.insert({
					title: resourceTitle.trim(),
					description: resourceDescription.trim() || null,
					resource_type: "link",
					content_url: resourceUrl.trim(),
					access_level: "member",
					is_active: true
				})
				.select()
				.single();

			if (resourceError) throw resourceError;

			// Link it to hackathon
			const { error: linkError } = await supabase
				.from("hackathon_resources")
				.insert({
					hackathon_id: selectedHackathon.id,
					resource_id: resourceData.id,
					display_order: hackathonResources.length
				});

			if (linkError) throw linkError;

			toast({ title: "Resource added", description: "Resource has been added to the hackathon." });
			setResourceTitle("");
			setResourceUrl("");
			setResourceDescription("");
			setShowAddResource(false);
			
			// Reload resources
			const { data: resData } = await supabase
				.from("hackathon_resources")
				.select(`
					*,
					member_resources(*)
				`)
				.eq("hackathon_id", selectedHackathon.id)
				.order("display_order");
			if (resData) {
				setHackathonResources(resData);
			}
		} catch (e: any) {
			toast({ title: "Failed to add resource", description: e.message || String(e) });
		}
	}

	async function deleteHackathonResource(resourceId: string, hackathonResourceId: string) {
		if (!selectedHackathon) return;
		try {
			// Delete from hackathon_resources
			await supabase
				.from("hackathon_resources")
				.delete()
				.eq("id", hackathonResourceId);

			// Optionally delete the resource itself if not used elsewhere
			await supabase
				.from("member_resources")
				.delete()
				.eq("id", resourceId);

			toast({ title: "Resource deleted", description: "Resource has been removed." });
			
			// Reload resources
			const { data: resData } = await supabase
				.from("hackathon_resources")
				.select(`
					*,
					member_resources(*)
				`)
				.eq("hackathon_id", selectedHackathon.id)
				.order("display_order");
			if (resData) {
				setHackathonResources(resData);
			}
		} catch (e: any) {
			toast({ title: "Failed to delete resource", description: e.message || String(e) });
		}
	}

	async function saveSubmissionConfig() {
		if (!selectedHackathon) return;

		try {
			const { error } = await supabase
				.from("events")
				.update({
					submission_page_enabled: submissionPageEnabled,
					submission_fields: submissionFields || null,
					updated_at: new Date().toISOString()
				})
				.eq("id", selectedHackathon.id);

			if (error) throw error;

			toast({ title: "Submission page updated", description: "Submission page configuration has been saved." });
			setShowSubmissionConfig(false);
			void loadEvents(true);
		} catch (e: any) {
			toast({ title: "Failed to save", description: e.message || String(e) });
		}
	}

	async function loadFeedbacks(reset = false) {
		if (!authed) return;
		setFeedbacksLoading(true);
		try {
			const page = reset ? 0 : Math.floor(feedbacks.length / PAGE_SIZE);
			const { data, error } = await supabase
				.from("member_feedback")
				.select(`
					*,
					members(full_name, email),
					events(title)
				`)
				.order("created_at", { ascending: false })
				.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

			if (error) throw error;
			const list = Array.isArray(data) ? data : [];
			setFeedbacks((prev) => (reset ? list : [...prev, ...list]));
			setFeedbacksHasMore(list.length === PAGE_SIZE);
		} catch (e: any) {
			toast({ title: "Failed to load feedbacks", description: e.message || String(e) });
		} finally {
			setFeedbacksLoading(false);
		}
	}

	async function deleteFeedback(id: string) {
		if (!confirm("Are you sure you want to delete this feedback?")) return;
		try {
			const { error } = await supabase
				.from("member_feedback")
				.delete()
				.eq("id", id);

			if (error) throw error;
			toast({ title: "Feedback deleted", description: "The feedback has been deleted." });
			void loadFeedbacks(true);
		} catch (e: any) {
			toast({ title: "Delete failed", description: e.message || String(e) });
		}
	}

	async function deleteItem(type: "application" | "message", id: string) {
		if (!token) {
			toast({ title: "Admin token required", description: "Set the moderator token to perform actions." });
			return;
		}
		if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
		try {
			const res = await fetch(`${SUPABASE_URL}/functions/v1/admin_delete`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-admin-token": token,
					"Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
				},
				body: JSON.stringify({ type, id }),
			});
			if (!res.ok) throw new Error(await res.text());
			toast({ title: "Deleted successfully" });
			// Reload all lists
			void loadApps("pending", true);
			void loadApps("approved", true);
			void loadApps("rejected", true);
			if (type === "message") void loadMsgs(true);
		} catch (e: any) {
			toast({ title: "Delete failed", description: e.message || String(e) });
		}
	}

	async function moderate(id: string, action: "approve" | "reject", reason?: string) {
		if (!token) {
			toast({ title: "Admin token required", description: "Set the moderator token to perform actions." });
			return;
		}
		setModeratingId(id);
		try {
			const res = await fetch(`${SUPABASE_URL}/functions/v1/moderate`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-admin-token": token,
					"Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
				},
				body: JSON.stringify({ id, action, reason }),
			});
			if (!res.ok) {
				const errorText = await res.text();
				throw new Error(errorText);
			}
			const result = await res.json();
			toast({ 
				title: `Application ${action}d`, 
				description: action === "approve" ? "Welcome email has been sent to the member." : "Rejection email has been sent." 
			});
			// Reload all status lists
			void loadApps("pending", true);
			void loadApps("approved", true);
			void loadApps("rejected", true);
			if (action === "approve") void loadMembers(true);
		} catch (e: any) {
			toast({ 
				title: "Moderation failed", 
				description: e.message || String(e),
				variant: "destructive"
			});
		} finally {
			setModeratingId(null);
		}
	}


	// Show login screen if not authenticated
	// Load 2FA status on mount from server
	useEffect(() => {
		if (authed) {
			// Check if admin has 2FA enabled from server
			fetch(`${SUPABASE_URL}/functions/v1/admin_2fa`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
				},
				body: JSON.stringify({ action: "check_status" }),
			})
				.then(res => res.json())
				.then(data => {
					setTwoFactorEnabled(data.enabled ?? false);
				})
				.catch(err => {
					console.error("Failed to load 2FA status:", err);
					setTwoFactorEnabled(false);
				});
		}
	}, [authed]);

	async function handleSetup2FA() {
		try {
			setTwoFactorVerifying(true);
			
			// Get secret and QR code from server
			const response = await fetch(`${SUPABASE_URL}/functions/v1/admin_2fa`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
				},
				body: JSON.stringify({ action: "setup" }),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to setup 2FA");
			}

			const data = await response.json();
			
			setTwoFactorSecret(data.secret);
			setTwoFactorQRCode(data.qrCode);
			setTwoFactorSetupMode(true);
			toast({ title: "2FA Setup", description: "Scan the QR code with your authenticator app." });
		} catch (e: any) {
			toast({ title: "Setup failed", description: e.message || "Please try again.", variant: "destructive" });
		} finally {
			setTwoFactorVerifying(false);
		}
	}

	async function handleEnable2FA() {
		if (!twoFactorCode.trim() || !twoFactorSecret) {
			toast({ title: "Code required", description: "Please enter the 6-digit code from your authenticator app." });
			return;
		}

		try {
			setTwoFactorVerifying(true);
			
			const code = twoFactorCode.trim();
			if (!/^\d{6}$/.test(code)) {
				throw new Error("Code must be 6 digits");
			}

			// Verify and enable 2FA via server
			const response = await fetch(`${SUPABASE_URL}/functions/v1/admin_2fa`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
				},
				body: JSON.stringify({ action: "enable", code, secret: twoFactorSecret }),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to enable 2FA");
			}

			const data = await response.json();
			
			if (!data.success) {
				throw new Error("Failed to enable 2FA");
			}
			
			setTwoFactorEnabled(true);
			setTwoFactorSetupMode(false);
			setTwoFactorSecret(null);
			setTwoFactorQRCode(null);
			setTwoFactorCode("");
			
			toast({ 
				title: "2FA Enabled", 
				description: "Two-factor authentication has been enabled for your admin account." 
			});
		} catch (e: any) {
			toast({ title: "Verification failed", description: e.message || "Please try again.", variant: "destructive" });
		} finally {
			setTwoFactorVerifying(false);
		}
	}

	async function handleDisable2FA() {
		try {
			// Disable 2FA via server
			const response = await fetch(`${SUPABASE_URL}/functions/v1/admin_2fa`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
				},
				body: JSON.stringify({ action: "disable" }),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to disable 2FA");
			}

			setTwoFactorEnabled(false);
			setTwoFactorSecret(null);
			setTwoFactorQRCode(null);
			toast({ title: "2FA Disabled", description: "Two-factor authentication has been disabled." });
		} catch (e: any) {
			toast({ title: "Failed to disable 2FA", description: e.message || "Please try again.", variant: "destructive" });
		}
	}

	if (!authed) {
		return <AdminFake404 onAuthenticated={() => setAuthed(true)} />;
	}

	return (
		<div className="min-h-screen bg-background text-foreground">
			<div className="container mx-auto px-4 py-8">
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-2xl font-bold">Admin Dashboard</h1>
					<div className="flex items-center gap-2">
						<Input
							placeholder="Search name, email, org, message..."
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								// Debounced reload
								clearTimeout((window as any)._adm_s);
								(window as any)._adm_s = setTimeout(() => {
									void loadApps("pending", true);
									void loadApps("approved", true);
									void loadApps("rejected", true);
									void loadMsgs(true);
									void loadMembers(true);
									void loadHackathonRegs(true);
                                void loadEvents(true);
								}, 300);
							}}
							className="w-80"
						/>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant={token ? "secondary" : "default"}>{token ? "Change Admin Token" : "Set Admin Token"}</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Moderator Token</DialogTitle>
                                </DialogHeader>
                                <AdminTokenForm onSave={save} onClear={clear} token={token || ""} />
                            </DialogContent>
                        </Dialog>
					</div>
				</div>

				<Tabs value={tab} onValueChange={setTab}>
                    <TabsList>
						<TabsTrigger value="applications">Join Applications</TabsTrigger>
						<TabsTrigger value="messages">Contact Messages</TabsTrigger>
                        <TabsTrigger value="members">Members</TabsTrigger>
                        <TabsTrigger value="events">Events</TabsTrigger>
                        <TabsTrigger value="hackathons">Hackathons</TabsTrigger>
                        <TabsTrigger value="feedback">Feedback</TabsTrigger>
                        <TabsTrigger value="settings">Settings</TabsTrigger>
					</TabsList>

					<TabsContent value="applications">
						<Card>
							<CardHeader>
								<CardTitle>Applications</CardTitle>
							</CardHeader>
							<CardContent>
								<Tabs value={appStatusTab} onValueChange={(v) => { setAppStatusTab(v as "pending" | "approved" | "rejected"); }}>
									<TabsList className="mb-4">
										<TabsTrigger value="pending">Pending ({appsPending.length})</TabsTrigger>
										<TabsTrigger value="approved">Approved ({appsApproved.length})</TabsTrigger>
										<TabsTrigger value="rejected">Rejected ({appsRejected.length})</TabsTrigger>
									</TabsList>
									<TabsContent value="pending">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>When</TableHead>
													<TableHead>Name</TableHead>
													<TableHead>Email</TableHead>
													<TableHead>Affiliation</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{appsPending.map((r) => (
													<TableRow key={r.id} className="hover:bg-card/50">
														<TableCell>{formatDate(r.created_at)}</TableCell>
														<TableCell>{r.full_name}</TableCell>
														<TableCell>{r.email}</TableCell>
														<TableCell className="capitalize">{r.affiliation}</TableCell>
														<TableCell className="text-right space-x-2">
															<Button size="sm" variant="outline" onClick={() => { setDetail(r); setOpenDetail(true); }}>View</Button>
															<Button 
																size="sm" 
																variant="secondary" 
																onClick={() => void moderate(r.id, "approve")}
																disabled={moderatingId === r.id}
															>
																{moderatingId === r.id ? (
																	<>
																		<Loader2 className="w-4 h-4 mr-2 animate-spin" />
																		Processing...
																	</>
																) : (
																	"Approve"
																)}
															</Button>
													<Button 
														size="sm" 
														variant="destructive" 
														onClick={() => { setRejectingId(r.id); setRejectOpen(true); }}
														disabled={moderatingId === r.id}
													>
														Reject
													</Button>
															<Button size="sm" variant="ghost" onClick={() => void deleteItem("application", r.id)}>Delete</Button>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
										<div className="flex justify-center mt-4">
											<Button variant="outline" disabled={!appsHasMore || appsLoading} onClick={() => void loadApps("pending", false)}>
												{appsLoading ? "Loading..." : appsHasMore ? "Load more" : "No more"}
											</Button>
										</div>
									</TabsContent>
									<TabsContent value="approved">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>When</TableHead>
													<TableHead>Name</TableHead>
													<TableHead>Email</TableHead>
													<TableHead>Affiliation</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{appsApproved.map((r) => (
													<TableRow key={r.id} className="hover:bg-card/50">
														<TableCell>{formatDate(r.created_at)}</TableCell>
														<TableCell>{r.full_name}</TableCell>
														<TableCell>{r.email}</TableCell>
														<TableCell className="capitalize">{r.affiliation}</TableCell>
														<TableCell className="text-right space-x-2">
															<Button size="sm" variant="outline" onClick={() => { setDetail(r); setOpenDetail(true); }}>View</Button>
															<Button size="sm" variant="ghost" onClick={() => void deleteItem("application", r.id)}>Delete</Button>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
										<div className="flex justify-center mt-4">
											<Button variant="outline" disabled={!appsHasMore || appsLoading} onClick={() => void loadApps("approved", false)}>
												{appsLoading ? "Loading..." : appsHasMore ? "Load more" : "No more"}
											</Button>
										</div>
									</TabsContent>
									<TabsContent value="rejected">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>When</TableHead>
													<TableHead>Name</TableHead>
													<TableHead>Email</TableHead>
													<TableHead>Affiliation</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{appsRejected.map((r) => (
													<TableRow key={r.id} className="hover:bg-card/50">
														<TableCell>{formatDate(r.created_at)}</TableCell>
														<TableCell>{r.full_name}</TableCell>
														<TableCell>{r.email}</TableCell>
														<TableCell className="capitalize">{r.affiliation}</TableCell>
														<TableCell className="text-right space-x-2">
															<Button size="sm" variant="outline" onClick={() => { setDetail(r); setOpenDetail(true); }}>View</Button>
															<Button size="sm" variant="ghost" onClick={() => void deleteItem("application", r.id)}>Delete</Button>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
										<div className="flex justify-center mt-4">
											<Button variant="outline" disabled={!appsHasMore || appsLoading} onClick={() => void loadApps("rejected", false)}>
												{appsLoading ? "Loading..." : appsHasMore ? "Load more" : "No more"}
											</Button>
						</div>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	</TabsContent>

					{/* Members Tab */}
		<TabsContent value="members">
						<Card>
							<CardHeader>
								<CardTitle>Verified Members ({members.length})</CardTitle>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Joined</TableHead>
											<TableHead>Name</TableHead>
											<TableHead>Email</TableHead>
											<TableHead>Cohort</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Portal Access</TableHead>
											<TableHead>From Email</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{members.length === 0 && !membersLoading ? (
											<TableRow>
												<TableCell colSpan={8} className="text-center text-muted-foreground">No members yet</TableCell>
											</TableRow>
										) : (
											members.map((m) => (
												<TableRow key={m.id} className="hover:bg-card/50">
													<TableCell>{formatDate(m.created_at)}</TableCell>
													<TableCell>{m.full_name}</TableCell>
													<TableCell>{m.email}</TableCell>
													<TableCell>{m.cohort || "-"}</TableCell>
											<TableCell>
														<Badge variant="secondary">{m.status || "active"}</Badge>
													</TableCell>
													<TableCell>
														{m.portal_accessed ? (
															<Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400">
																✓ Accessed
															</Badge>
														) : (
															<Badge variant="outline" className="text-muted-foreground">
																Not Yet
															</Badge>
														)}
														{m.first_portal_access_at && (
															<p className="text-xs text-muted-foreground mt-1">
																{formatDate(m.first_portal_access_at)}
															</p>
														)}
													</TableCell>
													<TableCell>
														{m.joined_from_email ? (
															<Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-400">
																✓ Email
															</Badge>
														) : (
															<span className="text-muted-foreground text-sm">-</span>
														)}
													</TableCell>
													<TableCell className="text-right space-x-2">
														<Button size="sm" variant="outline" onClick={() => void loadMemberDetails(m.id)}>View Details</Button>
														<Button size="sm" variant="destructive" onClick={() => { setDeleteMemberId(m.id); setDeleteMemberOpen(true); }}>Delete</Button>
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
								<div className="flex justify-center mt-4">
									<Button variant="outline" disabled={!membersHasMore || membersLoading} onClick={() => void loadMembers(false)}>
										{membersLoading ? "Loading..." : membersHasMore ? "Load more" : "No more"}
									</Button>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Events Tab */}
					<TabsContent value="events">
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle>Events & Hackathons ({events.length})</CardTitle>
									<Button 
										onClick={() => {
											setEditingEvent(null);
											setEventFormData({
											title: "",
											description: "",
											event_type: "workshop",
											start_date: "",
											end_date: "",
											location: "",
											registration_link: "",
											max_participants: "",
											fee_amount: "0",
											fee_currency: "PKR",
											payment_required: false,
											notify_members: false,
											category: "",
											tags: "",
											image_url: "",
											registration_deadline: "",
											status: "upcoming",
											is_active: true,
											is_member_only: true,
										});
										setShowEventForm(true);
									}}>
										Create Event
									</Button>
								</div>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Title</TableHead>
											<TableHead>Type</TableHead>
											<TableHead>Start Date</TableHead>
											<TableHead>Fee</TableHead>
											<TableHead>Registrations</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Active</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{events.length === 0 && !eventsLoading ? (
											<TableRow>
												<TableCell colSpan={8} className="text-center text-muted-foreground">No events yet. Create your first event!</TableCell>
											</TableRow>
										) : (
											events.map((event) => (
												<TableRow key={event.id} className="hover:bg-card/50">
													<TableCell className="font-medium">{event.title}</TableCell>
													<TableCell>
														<Badge variant="outline" className="capitalize">{event.event_type}</Badge>
													</TableCell>
													<TableCell>{formatDate(event.start_date)}</TableCell>
													<TableCell>
														{event.payment_required && event.fee_amount ? (
															<span>{event.fee_amount} {event.fee_currency}</span>
														) : (
															<span className="text-muted-foreground">Free</span>
														)}
													</TableCell>
													<TableCell>
														<Badge variant="secondary">{event.registration_count || 0}</Badge>
													</TableCell>
													<TableCell>
														<Badge variant="secondary">Upcoming</Badge>
													</TableCell>
													<TableCell>
														<Badge variant={event.is_active ? "secondary" : "outline"}>
															{event.is_active ? "Active" : "Inactive"}
														</Badge>
													</TableCell>
													<TableCell className="text-right space-x-2">
														{event.event_type === "hackathon" && (
															<Button 
																size="sm" 
																variant="default"
																onClick={async () => {
																	setSelectedHackathon(event);
																	// Load hackathon resources
																	const { data: resData } = await supabase
																		.from("hackathon_resources")
																		.select(`
																			*,
																			member_resources(*)
																		`)
																		.eq("hackathon_id", event.id)
																		.order("display_order");
																	if (resData) {
																		setHackathonResources(resData);
																	}
																	setSubmissionPageEnabled(event.submission_page_enabled || false);
																	setSubmissionFields(event.submission_fields || null);
																	setShowHackathonManage(true);
																}}
															>
																Manage
															</Button>
														)}
														<Button size="sm" variant="outline" onClick={() => {
															setEditingEvent(event);
															setEventFormData({
																title: event.title || "",
																description: event.description || "",
																event_type: event.event_type || "workshop",
																start_date: event.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : "",
																end_date: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : "",
																location: event.location || "",
																registration_link: event.registration_link || "",
																max_participants: event.max_participants?.toString() || "",
																fee_amount: event.fee_amount?.toString() || "0",
																fee_currency: event.fee_currency || "PKR",
																payment_required: event.payment_required || false,
																notify_members: event.notify_members || false,
																category: event.category || "none",
																tags: Array.isArray(event.tags) ? event.tags.join(", ") : event.tags || "",
																image_url: event.image_url || "",
																registration_deadline: event.registration_deadline ? new Date(event.registration_deadline).toISOString().slice(0, 16) : "",
																status: event.status || "upcoming",
																is_active: event.is_active ?? true,
																is_member_only: event.is_member_only ?? true,
															});
															setShowEventForm(true);
														}}>
															Edit
														</Button>
														<Button size="sm" variant="ghost" onClick={() => {
															if (confirm(`Delete "${event.title}"? This will delete all related data (registrations, teams, submissions, resources). This cannot be undone.`)) {
																void deleteEvent(event.id);
															}
														}}>
															Delete
														</Button>
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
								<div className="flex justify-center mt-4">
									<Button variant="outline" onClick={() => void loadEvents(true)} disabled={eventsLoading}>
										{eventsLoading ? "Loading..." : "Refresh"}
									</Button>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Hackathons Tab */}
					<TabsContent value="hackathons">
						<Card>
							<CardHeader>
								<CardTitle>Hackathon Registrations ({hackathonRegs.length})</CardTitle>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>When</TableHead>
											<TableHead>Member</TableHead>
											<TableHead>Hackathon</TableHead>
											<TableHead>Payment Details</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{hackathonRegs.length === 0 && !hackRegsLoading ? (
											<TableRow>
												<TableCell colSpan={6} className="text-center text-muted-foreground">No hackathon registrations yet</TableCell>
											</TableRow>
										) : (
											hackathonRegs.map((reg) => {
												const event = reg.events;
												const paymentRequired = event?.payment_required;
												return (
													<TableRow key={reg.id} className="hover:bg-card/50">
														<TableCell>{formatDate(reg.created_at)}</TableCell>
														<TableCell>
															<div>
																<p className="font-medium">{reg.members?.full_name || "-"}</p>
																<p className="text-xs text-muted-foreground">{reg.members?.email || "-"}</p>
															</div>
														</TableCell>
														<TableCell>
															<div>
																<p className="font-medium">{event?.title || "-"}</p>
																{paymentRequired && event?.fee_amount && (
																	<p className="text-xs text-muted-foreground">Fee: {event.fee_amount} {event.fee_currency}</p>
																)}
															</div>
														</TableCell>
														<TableCell>
															<div className="text-sm space-y-1">
																{paymentRequired ? (
																	<>
																		{reg.payment_method && (
																			<p><span className="font-medium">Method:</span> {reg.payment_method}</p>
																		)}
																		{reg.payment_amount && (
																			<p><span className="font-medium">Amount:</span> PKR {reg.payment_amount}</p>
																		)}
																		{reg.transaction_id && (
																			<p><span className="font-medium">Txn ID:</span> <span className="font-mono text-xs">{reg.transaction_id}</span></p>
																		)}
																		{reg.payment_date && (
																			<p><span className="font-medium">Date:</span> {formatDate(reg.payment_date)}</p>
																		)}
																		{reg.payment_proof_url && (
																			<Badge variant="outline" className="mt-1">Proof Available</Badge>
																		)}
																	</>
																) : (
																	<p className="text-muted-foreground">Free Event</p>
																)}
															</div>
														</TableCell>
														<TableCell>
															<Badge variant={reg.status === "approved" ? "secondary" : reg.status === "rejected" ? "destructive" : "outline"}>
																{reg.status}
															</Badge>
															{reg.rejection_reason && (
																<p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate" title={reg.rejection_reason}>
																	Reason: {reg.rejection_reason}
																</p>
															)}
														</TableCell>
														<TableCell className="text-right space-x-2">
															{reg.status === "pending" && (
																<>
																	<Button 
																		size="sm" 
																		variant="secondary" 
																		onClick={() => void moderateHackathon(reg.id, "approve")}
																		disabled={moderatingHackathonId === reg.id}
																	>
																		{moderatingHackathonId === reg.id ? (
																			<>
																				<Loader2 className="w-4 h-4 mr-2 animate-spin" />
																				Processing...
																			</>
																		) : (
																			"Approve"
																		)}
																	</Button>
																	<Button 
																		size="sm" 
																		variant="destructive" 
																		onClick={() => {
																			setHackRejectingId(reg.id);
																			setHackRejectOpen(true);
																		}}
																		disabled={moderatingHackathonId === reg.id}
																	>
																		Reject
																	</Button>
																</>
															)}
															{reg.payment_proof_url && (
																<Button 
																	size="sm" 
																	variant="outline" 
																	onClick={() => {
																		setPaymentProofViewer(reg.payment_proof_url);
																		setViewingHackathonReg(reg);
																	}}
																>
																	View Proof
																</Button>
															)}
															{paymentRequired && (
																<Button 
																	size="sm" 
																	variant="ghost" 
																	onClick={() => {
																		setViewingHackathonReg({ ...reg, events: event });
																	}}
																	title="View IBAN Details"
																>
																	IBAN Info
																</Button>
															)}
														</TableCell>
													</TableRow>
												);
											})
										)}
									</TableBody>
								</Table>
								<div className="flex justify-center mt-4">
									<Button variant="outline" disabled={!hackRegsHasMore || hackRegsLoading} onClick={() => void loadHackathonRegs(false)}>
										{hackRegsLoading ? "Loading..." : hackRegsHasMore ? "Load more" : "No more"}
									</Button>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="messages">
						<Card>
							<CardHeader>
								<CardTitle>Contact Messages</CardTitle>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>When</TableHead>
											<TableHead>Name</TableHead>
											<TableHead>Email</TableHead>
											<TableHead>Message</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{msgs.map((m) => (
											<TableRow key={m.id} className="hover:bg-card/50">
												<TableCell>{formatDate(m.created_at)}</TableCell>
												<TableCell>{m.name}</TableCell>
												<TableCell>{m.email}</TableCell>
												<TableCell className="max-w-[520px] truncate" title={m.message}>{m.message}</TableCell>
												<TableCell className="text-right">
													<Button size="sm" variant="ghost" onClick={() => void deleteItem("message", m.id)}>Delete</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
								<div className="flex justify-center mt-4">
									<Button variant="outline" disabled={!msgsHasMore || msgsLoading} onClick={() => void loadMsgs(false)}>
										{msgsLoading ? "Loading..." : msgsHasMore ? "Load more" : "No more"}
									</Button>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Feedback Tab */}
					<TabsContent value="feedback">
						<Card>
							<CardHeader>
								<CardTitle>Member Feedback ({feedbacks.length})</CardTitle>
								<CardDescription>View and manage feedback submitted by members</CardDescription>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>When</TableHead>
											<TableHead>Member</TableHead>
											<TableHead>Type</TableHead>
											<TableHead>Subject</TableHead>
											<TableHead>Rating</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{feedbacks.length === 0 && !feedbacksLoading ? (
											<TableRow>
												<TableCell colSpan={7} className="text-center text-muted-foreground">No feedback yet</TableCell>
											</TableRow>
										) : (
											feedbacks.map((feedback) => (
												<TableRow key={feedback.id} className="hover:bg-card/50">
													<TableCell>{formatDate(feedback.created_at)}</TableCell>
													<TableCell>
														<div>
															<p className="font-medium">{feedback.members?.full_name || "-"}</p>
															<p className="text-xs text-muted-foreground">{feedback.members?.email || "-"}</p>
														</div>
													</TableCell>
													<TableCell>
														<Badge variant="outline" className="capitalize">{feedback.feedback_type}</Badge>
													</TableCell>
													<TableCell className="max-w-[200px] truncate" title={feedback.subject || feedback.message}>
														{feedback.subject || "(No subject)"}
													</TableCell>
													<TableCell>
														{feedback.rating ? (
															<div className="flex items-center gap-1">
																<span className="text-yellow-500">★</span>
																<span>{feedback.rating}/5</span>
															</div>
														) : (
															<span className="text-muted-foreground">-</span>
														)}
													</TableCell>
													<TableCell>
														<Badge variant={feedback.status === "new" ? "default" : feedback.status === "resolved" ? "secondary" : "outline"} className="capitalize">
															{feedback.status}
														</Badge>
													</TableCell>
													<TableCell className="text-right space-x-2">
														<Button size="sm" variant="outline" onClick={() => {
															setDetail(feedback);
															setOpenDetail(true);
														}}>View</Button>
														<Button size="sm" variant="ghost" onClick={() => void deleteFeedback(feedback.id)}>Delete</Button>
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
								<div className="flex justify-center mt-4">
									<Button variant="outline" disabled={!feedbacksHasMore || feedbacksLoading} onClick={() => void loadFeedbacks(false)}>
										{feedbacksLoading ? "Loading..." : feedbacksHasMore ? "Load more" : "No more"}
									</Button>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="settings">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Shield className="w-5 h-5" />
									Security Settings
								</CardTitle>
								<CardDescription>Manage your admin account security settings</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								{/* Two-Factor Authentication Section */}
								<div className="border rounded-lg p-6 space-y-4">
									<div className="flex items-center justify-between">
										<div>
											<h3 className="font-semibold text-lg flex items-center gap-2">
												<Shield className="w-5 h-5" />
												Two-Factor Authentication (2FA)
											</h3>
											<p className="text-sm text-muted-foreground mt-1">
												Add an extra layer of security to your admin account
											</p>
										</div>
										<Badge variant={twoFactorEnabled ? "secondary" : "outline"}>
											{twoFactorEnabled ? "Enabled" : "Disabled"}
										</Badge>
									</div>

									{!twoFactorEnabled && !twoFactorSetupMode && (
										<div className="space-y-4">
											<p className="text-sm text-muted-foreground">
												Two-factor authentication adds an additional security layer. When enabled, you'll need to enter a code from your authenticator app in addition to your password.
											</p>
											<Button
												onClick={handleSetup2FA}
												disabled={twoFactorVerifying}
												className="w-full sm:w-auto"
											>
												{twoFactorVerifying ? "Setting up..." : "Enable 2FA"}
											</Button>
										</div>
									)}

									{twoFactorSetupMode && twoFactorQRCode && (
										<div className="space-y-4">
											<div className="bg-muted/50 p-4 rounded-lg border space-y-3">
												<p className="text-sm font-medium">Scan this QR code with your authenticator app:</p>
												<div className="flex justify-center p-4 bg-white rounded-lg">
													<QRCodeSVG value={twoFactorQRCode} size={200} />
												</div>
												<p className="text-xs text-muted-foreground text-center">
													Use apps like Google Authenticator, Authy, or Microsoft Authenticator
												</p>
											</div>

											<div className="space-y-2">
												<label className="text-sm font-medium">Enter 6-digit code from your app</label>
												<Input
													type="text"
													value={twoFactorCode}
													onChange={(e) => {
														const val = e.target.value.replace(/\D/g, "").slice(0, 6);
														setTwoFactorCode(val);
													}}
													placeholder="000000"
													maxLength={6}
													className="text-center text-2xl tracking-widest font-mono"
												/>
											</div>

											<div className="flex gap-2">
												<Button
													onClick={handleEnable2FA}
													disabled={twoFactorCode.length !== 6 || twoFactorVerifying}
													className="flex-1"
												>
													{twoFactorVerifying ? "Verifying..." : "Verify & Enable"}
												</Button>
												<Button
													variant="outline"
													onClick={() => {
														setTwoFactorSetupMode(false);
														setTwoFactorSecret(null);
														setTwoFactorQRCode(null);
														setTwoFactorCode("");
													}}
												>
													Cancel
												</Button>
											</div>
										</div>
									)}

									{twoFactorEnabled && !twoFactorSetupMode && (
										<div className="space-y-4">
											<div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
												<p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
													<Shield className="w-4 h-4" />
													Two-factor authentication is enabled for your admin account.
												</p>
											</div>
											<Button
												variant="destructive"
												onClick={handleDisable2FA}
												className="w-full sm:w-auto"
											>
												Disable 2FA
											</Button>
										</div>
									)}
								</div>

								{/* Session Management */}
								<div className="border rounded-lg p-6 space-y-4">
									<h3 className="font-semibold text-lg">Session Management</h3>
									<div className="space-y-2">
										<p className="text-sm text-muted-foreground">
											Your current session will expire after 8 hours of inactivity.
										</p>
										<Button
											variant="outline"
											onClick={() => {
												sessionStorage.removeItem("shadowmesh_admin_basic_auth");
												sessionStorage.removeItem("shadowmesh_admin_authenticated_at");
												window.location.reload();
											}}
										>
											Logout
										</Button>
									</div>
								</div>

								{/* Security Information */}
								<div className="border rounded-lg p-6 space-y-4 bg-muted/30">
									<h3 className="font-semibold text-lg">Security Features</h3>
									<ul className="space-y-2 text-sm text-muted-foreground">
										<li className="flex items-start gap-2">
											<span className="text-green-500">✓</span>
											<span>Rate limiting: Maximum 5 login attempts per minute</span>
										</li>
										<li className="flex items-start gap-2">
											<span className="text-green-500">✓</span>
											<span>Account lockout: 15 minutes after 5 failed attempts</span>
										</li>
										<li className="flex items-start gap-2">
											<span className="text-green-500">✓</span>
											<span>Session timeout: 8 hours</span>
										</li>
										<li className="flex items-start gap-2">
											<span className="text-green-500">✓</span>
											<span>Fake 404 page with secret click mechanism</span>
										</li>
										{twoFactorEnabled && (
											<li className="flex items-start gap-2">
												<span className="text-green-500">✓</span>
												<span>Two-factor authentication enabled</span>
											</li>
										)}
									</ul>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>

			<Dialog open={openDetail} onOpenChange={setOpenDetail}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>{detail && 'feedback_type' in detail ? "Feedback Details" : "Application Details"}</DialogTitle>
					</DialogHeader>
					{detail && 'feedback_type' in detail ? (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-3">
								<div><span className="text-sm text-muted-foreground">Member</span><div>{detail.members?.full_name || "-"}</div></div>
								<div><span className="text-sm text-muted-foreground">Email</span><div>{detail.members?.email || "-"}</div></div>
								<div><span className="text-sm text-muted-foreground">Type</span><div className="capitalize">{detail.feedback_type}</div></div>
								<div><span className="text-sm text-muted-foreground">Status</span><div className="capitalize">{detail.status}</div></div>
								{detail.rating && (
									<div><span className="text-sm text-muted-foreground">Rating</span><div className="flex items-center gap-1"><span className="text-yellow-500">★</span><span>{detail.rating}/5</span></div></div>
								)}
								<div><span className="text-sm text-muted-foreground">Submitted</span><div>{formatDate(detail.created_at)}</div></div>
								{detail.related_event_id && (
									<div className="col-span-2"><span className="text-sm text-muted-foreground">Related Event</span><div>{detail.events?.title || "-"}</div></div>
								)}
								{detail.subject && (
									<div className="col-span-2"><span className="text-sm text-muted-foreground">Subject</span><div>{detail.subject}</div></div>
								)}
							</div>
							<div className="border-t pt-3">
								<span className="text-sm text-muted-foreground">Message</span>
								<div className="mt-2 p-3 bg-muted rounded-md whitespace-pre-wrap">{detail.message}</div>
							</div>
							{detail.admin_notes && (
								<div className="border-t pt-3">
									<span className="text-sm text-muted-foreground">Admin Notes</span>
									<div className="mt-2 p-3 bg-muted rounded-md whitespace-pre-wrap">{detail.admin_notes}</div>
								</div>
							)}
						</div>
					) : (
						<DetailView detail={detail} />
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setOpenDetail(false)}>Close</Button>
						{detail && !('feedback_type' in detail) && detail.status === "pending" && (
							<>
								<Button variant="secondary" onClick={() => { void moderate(detail.id, "approve"); }}>Approve</Button>
								<Button variant="destructive" onClick={() => { setRejectingId(detail.id); setRejectOpen(true); }}>Reject</Button>
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Reject Reason Modal */}
			<Dialog open={rejectOpen} onOpenChange={(open) => {
				if (!open) {
					setRejectOpen(false);
					setRejectReason("");
					setRejectingId(null);
				}
			}}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Reject Application</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div>
							<label className="block text-sm font-medium mb-2">Reason for rejection <span className="text-muted-foreground">(required)</span></label>
							<Textarea
								value={rejectReason}
								onChange={(e) => setRejectReason(e.target.value)}
								placeholder="e.g., Application lacks required details. Please re-apply with more information."
								rows={4}
								className="bg-background/50 border-border focus:border-destructive"
							/>
							<p className="text-xs text-muted-foreground mt-1">This reason will be sent to the applicant via email.</p>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => {
							setRejectOpen(false);
							setRejectReason("");
							setRejectingId(null);
						}}>Cancel</Button>
						<Button
							variant="destructive"
							disabled={!rejectReason.trim() || !rejectingId}
							onClick={() => {
								if (rejectingId && rejectReason.trim()) {
									void moderate(rejectingId, "reject", rejectReason.trim());
									setRejectOpen(false);
									setRejectReason("");
									setRejectingId(null);
								}
							}}
						>
							Reject Application
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Hackathon Reject Reason Modal */}
			<Dialog open={hackRejectOpen} onOpenChange={(open) => {
				if (!open) {
					setHackRejectOpen(false);
					setHackRejectReason("");
					setHackRejectingId(null);
				}
			}}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Reject Hackathon Registration</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div>
							<label className="block text-sm font-medium mb-2">Reason for rejection <span className="text-muted-foreground">(required)</span></label>
							<Textarea
								value={hackRejectReason}
								onChange={(e) => setHackRejectReason(e.target.value)}
								placeholder="e.g., Payment proof is unclear or transaction ID doesn't match. Please re-submit with correct payment details."
								rows={4}
								className="bg-background/50 border-border focus:border-destructive"
							/>
							<p className="text-xs text-muted-foreground mt-1">This reason will be sent to the member via email.</p>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => {
							setHackRejectOpen(false);
							setHackRejectReason("");
							setHackRejectingId(null);
						}}>Cancel</Button>
						<Button
							variant="destructive"
							disabled={!hackRejectReason.trim() || !hackRejectingId}
							onClick={() => {
								if (hackRejectingId && hackRejectReason.trim()) {
									void moderateHackathon(hackRejectingId, "reject", hackRejectReason.trim());
									setHackRejectOpen(false);
									setHackRejectReason("");
									setHackRejectingId(null);
								}
							}}
						>
							Reject Registration
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Payment Proof Viewer Modal */}
			<Dialog open={!!paymentProofViewer} onOpenChange={(open) => {
				if (!open) {
					setPaymentProofViewer(null);
					setViewingHackathonReg(null);
				}
			}}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Payment Proof</DialogTitle>
						<DialogDescription>
							{viewingHackathonReg && (
								<div className="text-sm space-y-1 mt-2">
									<p><span className="font-medium">Member:</span> {viewingHackathonReg.members?.full_name || "-"}</p>
									<p><span className="font-medium">Hackathon:</span> {viewingHackathonReg.events?.title || "-"}</p>
									{viewingHackathonReg.transaction_id && (
										<p><span className="font-medium">Transaction ID:</span> <span className="font-mono">{viewingHackathonReg.transaction_id}</span></p>
									)}
								</div>
							)}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						{paymentProofViewer && (
							<div className="border rounded-lg overflow-hidden">
								<img 
									src={paymentProofViewer} 
									alt="Payment Proof" 
									className="w-full h-auto max-h-[600px] object-contain"
									onError={(e) => {
										(e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3EImage not available%3C/text%3E%3C/svg%3E";
									}}
								/>
							</div>
						)}
						{viewingHackathonReg && viewingHackathonReg.payment_proof_url && (
							<div className="flex gap-2">
								<Button variant="outline" asChild>
									<a href={viewingHackathonReg.payment_proof_url} target="_blank" rel="noopener noreferrer">
										Open in New Tab
									</a>
								</Button>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			{/* IBAN Details Modal */}
			<Dialog open={!!viewingHackathonReg && !paymentProofViewer && viewingHackathonReg.events?.payment_required} onOpenChange={(open) => {
				if (!open) {
					setViewingHackathonReg(null);
				}
			}}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Bank Transfer Details</DialogTitle>
						<DialogDescription>
							{viewingHackathonReg?.events?.title && (
								<p className="mt-2">Payment information for: {viewingHackathonReg.events.title}</p>
							)}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="bg-muted/50 p-4 rounded-lg border space-y-2">
							<div>
								<p className="text-sm font-medium mb-1">Account Name</p>
								<p className="text-lg font-semibold">Zeeshan</p>
							</div>
							<div>
								<p className="text-sm font-medium mb-1">IBAN</p>
								<p className="text-lg font-mono">PK08 MEZN 0000 3001 1288 7110</p>
							</div>
							<div>
								<p className="text-sm font-medium mb-1">Account Number</p>
								<p className="text-lg font-mono">0030 0112887110</p>
							</div>
							<div>
								<p className="text-sm font-medium mb-1">Bank</p>
								<p className="text-lg">Meezan Bank</p>
							</div>
							{viewingHackathonReg?.events?.fee_amount && (
								<div className="pt-2 border-t">
									<p className="text-sm font-medium mb-1">Required Amount</p>
									<p className="text-xl font-bold text-primary">{viewingHackathonReg.events.fee_amount} {viewingHackathonReg.events.fee_currency}</p>
								</div>
							)}
						</div>
						<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
							<p className="text-sm text-yellow-400">
								<strong>Note:</strong> Members should transfer the exact amount and include their transaction ID in the payment reference.
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setViewingHackathonReg(null)}>Close</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Member Details Dialog */}
			<Dialog open={showMemberDetails} onOpenChange={setShowMemberDetails}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Member Details</DialogTitle>
					</DialogHeader>
					{memberDetails && (
						<div className="space-y-6">
							<div>
								<h3 className="font-semibold mb-2">Basic Info</h3>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="text-sm text-muted-foreground">Name</label>
										<p className="font-medium">{memberDetails.member.full_name}</p>
									</div>
									<div>
										<label className="text-sm text-muted-foreground">Email</label>
										<p className="font-medium">{memberDetails.member.email}</p>
									</div>
									<div>
										<label className="text-sm text-muted-foreground">Email Verified</label>
										<p className="text-sm">{memberDetails.member.email_verified ? "✓ Verified" : "Not verified"}</p>
									</div>
									<div>
										<label className="text-sm text-muted-foreground">Member Since</label>
										<p>{formatDate(memberDetails.member.created_at)}</p>
									</div>
									{memberDetails.member.cohort && (
										<div>
											<label className="text-sm text-muted-foreground">Cohort</label>
											<p>{memberDetails.member.cohort}</p>
										</div>
									)}
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-2">Event Registrations ({memberDetails.events?.length || 0})</h3>
								{memberDetails.events?.length > 0 ? (
									<div className="space-y-2">
										{memberDetails.events.map((e: any) => (
											<div key={e.id} className="p-2 bg-muted rounded">
												<p className="font-medium">{e.events?.title || "-"}</p>
												<p className="text-xs text-muted-foreground">{e.events?.event_type} • {formatDate(e.events?.start_date || e.created_at)}</p>
											</div>
										))}
									</div>
								) : (
									<p className="text-sm text-muted-foreground">No event registrations</p>
								)}
							</div>

							<div>
								<h3 className="font-semibold mb-2">Hackathon Registrations ({memberDetails.hackathons?.length || 0})</h3>
								{memberDetails.hackathons?.length > 0 ? (
									<div className="space-y-2">
										{memberDetails.hackathons.map((h: any) => (
											<div key={h.id} className="p-2 bg-muted rounded">
												<div className="flex items-center justify-between">
													<div>
														<p className="font-medium">{h.events?.title || "-"}</p>
														<p className="text-xs text-muted-foreground">Status: {h.status} • {formatDate(h.created_at)}</p>
													</div>
													<Badge variant={h.status === "approved" ? "secondary" : h.status === "rejected" ? "destructive" : "outline"}>
														{h.status}
													</Badge>
												</div>
											</div>
										))}
									</div>
								) : (
									<p className="text-sm text-muted-foreground">No hackathon registrations</p>
								)}
							</div>

							<div>
								<h3 className="font-semibold mb-2">Teams ({memberDetails.teams?.length || 0})</h3>
								{memberDetails.teams?.length > 0 ? (
									<div className="space-y-2">
										{memberDetails.teams.map((t: any) => (
											<div key={t.id} className="p-2 bg-muted rounded">
												<p className="font-medium">{t.team_name}</p>
												<p className="text-xs text-muted-foreground">Members: {t.team_members?.length || 0}/4 • Status: {t.status}</p>
											</div>
										))}
									</div>
								) : (
									<p className="text-sm text-muted-foreground">No teams</p>
								)}
							</div>

							<div>
								<h3 className="font-semibold mb-2">Recent Activity ({memberDetails.activity?.length || 0})</h3>
								{memberDetails.activity?.length > 0 ? (
									<div className="space-y-1">
										{memberDetails.activity.slice(0, 10).map((a: any) => (
											<div key={a.id} className="text-sm p-2 bg-muted rounded">
												<p className="capitalize">{a.activity_type.replace(/_/g, " ")}</p>
												<p className="text-xs text-muted-foreground">{formatDate(a.created_at)}</p>
											</div>
										))}
									</div>
								) : (
									<p className="text-sm text-muted-foreground">No activity</p>
								)}
							</div>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowMemberDetails(false)}>Close</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Member Dialog */}
			<Dialog open={deleteMemberOpen} onOpenChange={(open) => {
				if (!open) {
					setDeleteMemberOpen(false);
					setDeleteMemberReason("");
					setDeleteMemberId(null);
				}
			}}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Delete Member</DialogTitle>
						<DialogDescription>This action cannot be undone. The member will be notified via email.</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div>
							<label className="block text-sm font-medium mb-2">Reason for deletion (optional)</label>
							<Textarea
								value={deleteMemberReason}
								onChange={(e) => setDeleteMemberReason(e.target.value)}
								placeholder="e.g., Violation of community guidelines"
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => {
							setDeleteMemberOpen(false);
							setDeleteMemberReason("");
							setDeleteMemberId(null);
						}}>Cancel</Button>
						<Button
							variant="destructive"
							onClick={() => void deleteMember()}
						>
							Delete Member
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Event Form Dialog */}
			<Dialog open={showEventForm} onOpenChange={(open) => {
				if (!open) {
					setShowEventForm(false);
					setEditingEvent(null);
				}
			}}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{editingEvent ? "Edit Event" : "Create New Event"}</DialogTitle>
						<DialogDescription>
							{editingEvent ? "Update event details. Changes will be reflected immediately in member portals." : "Create a new event or hackathon. It will be visible in member portals immediately after creation."}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="md:col-span-2">
								<label className="block text-sm font-medium mb-2">Event Title <span className="text-destructive">*</span></label>
								<Input
									value={eventFormData.title}
									onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
									placeholder="e.g., Cybersecurity Workshop: Into the Breach"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Event Type <span className="text-destructive">*</span></label>
								<Select value={eventFormData.event_type} onValueChange={(v) => setEventFormData({ ...eventFormData, event_type: v })}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="workshop">Workshop</SelectItem>
										<SelectItem value="hackathon">Hackathon</SelectItem>
										<SelectItem value="meetup">Meetup</SelectItem>
										<SelectItem value="webinar">Webinar</SelectItem>
										<SelectItem value="other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Category</label>
								<Select value={eventFormData.category || undefined} onValueChange={(v) => setEventFormData({ ...eventFormData, category: v === "none" ? "" : v })}>
									<SelectTrigger>
										<SelectValue placeholder="Select category" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">None</SelectItem>
										<SelectItem value="cyber">Cybersecurity</SelectItem>
										<SelectItem value="ai">AI / Machine Learning</SelectItem>
										<SelectItem value="fusion">AI × Cyber Fusion</SelectItem>
										<SelectItem value="general">General</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Start Date & Time <span className="text-destructive">*</span></label>
								<Input
									type="datetime-local"
									value={eventFormData.start_date}
									onChange={(e) => setEventFormData({ ...eventFormData, start_date: e.target.value })}
									required
									min={new Date().toISOString().slice(0, 16)}
								/>
								<p className="text-xs text-muted-foreground mt-1">
									Please select both date and time
								</p>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">End Date & Time</label>
								<Input
									type="datetime-local"
									value={eventFormData.end_date}
									onChange={(e) => setEventFormData({ ...eventFormData, end_date: e.target.value })}
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Location</label>
								<Input
									value={eventFormData.location}
									onChange={(e) => setEventFormData({ ...eventFormData, location: e.target.value })}
									placeholder="e.g., RIUF Campus, Online, etc."
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Max Participants</label>
								<Input
									type="number"
									value={eventFormData.max_participants}
									onChange={(e) => setEventFormData({ ...eventFormData, max_participants: e.target.value })}
									placeholder="Leave empty for unlimited"
									min="1"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Registration Deadline</label>
								<Input
									type="datetime-local"
									value={eventFormData.registration_deadline}
									onChange={(e) => setEventFormData({ ...eventFormData, registration_deadline: e.target.value })}
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">External Registration Link (optional)</label>
								<Input
									type="url"
									value={eventFormData.registration_link}
									onChange={(e) => setEventFormData({ ...eventFormData, registration_link: e.target.value })}
									placeholder="https://... (leave empty for in-app registration)"
								/>
								<p className="text-xs text-muted-foreground mt-1">
									Leave empty to use our in-app registration system. Only add a link for external registrations (e.g., Google Forms).
								</p>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Image URL</label>
								<Input
									type="url"
									value={eventFormData.image_url}
									onChange={(e) => setEventFormData({ ...eventFormData, image_url: e.target.value })}
									placeholder="https://..."
								/>
							</div>

							<div className="md:col-span-2">
								<label className="block text-sm font-medium mb-2">Description</label>
								<Textarea
									value={eventFormData.description}
									onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
									placeholder="Detailed event description..."
									rows={4}
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Tags (comma-separated)</label>
								<Input
									value={eventFormData.tags}
									onChange={(e) => setEventFormData({ ...eventFormData, tags: e.target.value })}
									placeholder="e.g., beginner, hands-on, networking"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Status</label>
								<Select value={eventFormData.status} onValueChange={(v) => setEventFormData({ ...eventFormData, status: v })}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="upcoming">Upcoming</SelectItem>
										<SelectItem value="ongoing">Ongoing</SelectItem>
										<SelectItem value="completed">Completed</SelectItem>
										<SelectItem value="cancelled">Cancelled</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Payment Section */}
						<div className="border-t pt-4 space-y-4">
							<h3 className="font-semibold">Payment Settings</h3>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div className="flex items-center space-x-2">
									<input
										type="checkbox"
										id="payment_required"
										checked={eventFormData.payment_required}
										onChange={(e) => setEventFormData({ ...eventFormData, payment_required: e.target.checked })}
										className="rounded"
									/>
									<label htmlFor="payment_required" className="text-sm font-medium">Payment Required</label>
								</div>

								{eventFormData.payment_required && (
									<>
										<div>
											<label className="block text-sm font-medium mb-2">Fee Amount</label>
											<Input
												type="number"
												step="0.01"
												min="0"
												value={eventFormData.fee_amount}
												onChange={(e) => setEventFormData({ ...eventFormData, fee_amount: e.target.value })}
												placeholder="0.00"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium mb-2">Currency</label>
											<Select value={eventFormData.fee_currency} onValueChange={(v) => setEventFormData({ ...eventFormData, fee_currency: v })}>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="PKR">PKR (Pakistani Rupee)</SelectItem>
													<SelectItem value="USD">USD (US Dollar)</SelectItem>
													<SelectItem value="EUR">EUR (Euro)</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</>
								)}
							</div>
						</div>

						{/* Settings Section */}
						<div className="border-t pt-4 space-y-3">
							<h3 className="font-semibold">Settings</h3>
							<div className="space-y-2">
								<div className="flex items-center space-x-2">
									<input
										type="checkbox"
										id="is_active"
										checked={eventFormData.is_active}
										onChange={(e) => setEventFormData({ ...eventFormData, is_active: e.target.checked })}
										className="rounded"
									/>
									<label htmlFor="is_active" className="text-sm font-medium">Active (visible in member portals)</label>
								</div>
								<div className="flex items-center space-x-2">
									<input
										type="checkbox"
										id="is_member_only"
										checked={eventFormData.is_member_only}
										onChange={(e) => setEventFormData({ ...eventFormData, is_member_only: e.target.checked })}
										className="rounded"
									/>
									<label htmlFor="is_member_only" className="text-sm font-medium">Members Only</label>
								</div>
								<div className="flex items-center space-x-2">
									<input
										type="checkbox"
										id="notify_members"
										checked={eventFormData.notify_members}
										onChange={(e) => setEventFormData({ ...eventFormData, notify_members: e.target.checked })}
										className="rounded"
									/>
									<label htmlFor="notify_members" className="text-sm font-medium">Notify Members (send email notification)</label>
								</div>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => {
							setShowEventForm(false);
							setEditingEvent(null);
						}}>
							Cancel
						</Button>
						<Button onClick={() => void saveEvent()}>
							{editingEvent ? "Update Event" : "Create Event"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Hackathon Management Dialog */}
			<Dialog open={showHackathonManage} onOpenChange={setShowHackathonManage}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="text-2xl">Manage Hackathon: {selectedHackathon?.title}</DialogTitle>
						<DialogDescription>Manage resources, submission page, and hackathon settings</DialogDescription>
					</DialogHeader>
					<div className="space-y-6 py-4">
						{/* Action Buttons */}
						<div className="grid grid-cols-3 gap-4">
							<Button 
								variant="outline" 
								className="h-24 flex flex-col items-center justify-center gap-2"
								onClick={() => {
									setShowAddResource(true);
									setShowHackathonManage(false);
								}}
							>
								<BookOpen className="w-6 h-6" />
								<span>Add Resource</span>
							</Button>
							<Button 
								variant="outline" 
								className="h-24 flex flex-col items-center justify-center gap-2"
								onClick={() => {
									setEditingEvent(selectedHackathon);
									setEventFormData({
										title: selectedHackathon?.title || "",
										description: selectedHackathon?.description || "",
										event_type: selectedHackathon?.event_type || "hackathon",
										start_date: selectedHackathon?.start_date ? new Date(selectedHackathon.start_date).toISOString().slice(0, 16) : "",
										end_date: selectedHackathon?.end_date ? new Date(selectedHackathon.end_date).toISOString().slice(0, 16) : "",
										location: selectedHackathon?.location || "",
										registration_link: selectedHackathon?.registration_link || "",
										max_participants: selectedHackathon?.max_participants?.toString() || "",
										fee_amount: selectedHackathon?.fee_amount?.toString() || "0",
										fee_currency: selectedHackathon?.fee_currency || "PKR",
										payment_required: selectedHackathon?.payment_required || false,
										notify_members: selectedHackathon?.notify_members || false,
										category: selectedHackathon?.category || "none",
										tags: Array.isArray(selectedHackathon?.tags) ? selectedHackathon.tags.join(", ") : selectedHackathon?.tags || "",
										image_url: selectedHackathon?.image_url || "",
										registration_deadline: selectedHackathon?.registration_deadline ? new Date(selectedHackathon.registration_deadline).toISOString().slice(0, 16) : "",
										status: selectedHackathon?.status || "upcoming",
										is_active: selectedHackathon?.is_active ?? true,
										is_member_only: selectedHackathon?.is_member_only ?? true,
									});
									setShowEventForm(true);
									setShowHackathonManage(false);
								}}
							>
								<FileText className="w-6 h-6" />
								<span>Update Details</span>
							</Button>
							<Button 
								variant="outline" 
								className="h-24 flex flex-col items-center justify-center gap-2"
								onClick={() => {
									setShowSubmissionConfig(true);
									setShowHackathonManage(false);
								}}
							>
								<Upload className="w-6 h-6" />
								<span>Configure Submission</span>
							</Button>
						</div>

						{/* Resources List */}
						<div>
							<h3 className="font-semibold text-lg mb-4">Hackathon Resources</h3>
							{hackathonResources.length === 0 ? (
								<p className="text-muted-foreground">No resources added yet.</p>
							) : (
								<div className="space-y-2">
									{hackathonResources.map((hr: any) => (
										<div key={hr.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
											<div>
												<p className="font-medium">{hr.member_resources?.title || "Resource"}</p>
												{hr.member_resources?.description && (
													<p className="text-sm text-muted-foreground">{hr.member_resources.description}</p>
												)}
												{hr.member_resources?.content_url && (
													<a href={hr.member_resources.content_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
														{hr.member_resources.content_url}
													</a>
												)}
											</div>
											<Button 
												size="sm" 
												variant="ghost"
												onClick={() => {
													if (confirm("Delete this resource?")) {
														deleteHackathonResource(hr.resource_id, hr.id);
													}
												}}
											>
												Delete
											</Button>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowHackathonManage(false)}>Close</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Add Resource Dialog */}
			<Dialog open={showAddResource} onOpenChange={setShowAddResource}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Resource</DialogTitle>
						<DialogDescription>Add a link, dataset, or resource for this hackathon</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium mb-2">Title</label>
							<Input
								value={resourceTitle}
								onChange={(e) => setResourceTitle(e.target.value)}
								placeholder="Resource title"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-2">URL / Link</label>
							<Input
								value={resourceUrl}
								onChange={(e) => setResourceUrl(e.target.value)}
								placeholder="https://example.com/resource"
								type="url"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-2">Description (optional)</label>
							<Textarea
								value={resourceDescription}
								onChange={(e) => setResourceDescription(e.target.value)}
								placeholder="Brief description of the resource"
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowAddResource(false)}>Cancel</Button>
						<Button onClick={addHackathonResource} disabled={!resourceTitle.trim() || !resourceUrl.trim()}>
							Add Resource
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Configure Submission Page Dialog */}
			<Dialog open={showSubmissionConfig} onOpenChange={setShowSubmissionConfig}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Configure Submission Page</DialogTitle>
						<DialogDescription>Enable and configure the submission page for this hackathon</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="flex items-center space-x-2">
							<input
								type="checkbox"
								id="submission_enabled"
								checked={submissionPageEnabled}
								onChange={(e) => setSubmissionPageEnabled(e.target.checked)}
								className="rounded"
							/>
							<label htmlFor="submission_enabled" className="text-sm font-medium">
								Enable Submission Page
							</label>
						</div>
						{submissionPageEnabled && (
							<div className="p-4 bg-muted rounded-lg">
								<p className="text-sm text-muted-foreground mb-4">
									Submission page will be available to approved participants. You can configure custom fields later.
								</p>
								<p className="text-xs text-muted-foreground">
									Default fields: Title, Description, Project URL, Video URL
								</p>
							</div>
						)}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowSubmissionConfig(false)}>Cancel</Button>
						<Button onClick={saveSubmissionConfig}>Save Configuration</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};

const DetailView = ({ detail }: { detail: JoinRow | null }) => {
	if (!detail) return null;
	return (
		<div className="space-y-3">
			<div className="grid grid-cols-2 gap-3">
				<div><span className="text-sm text-muted-foreground">Name</span><div>{detail.full_name}</div></div>
				<div><span className="text-sm text-muted-foreground">Email</span><div>{detail.email}</div></div>
				<div><span className="text-sm text-muted-foreground">Affiliation</span><div className="capitalize">{detail.affiliation}</div></div>
				<div><span className="text-sm text-muted-foreground">Phone</span><div>{detail.phone_e164 || detail.raw_phone || "-"}</div></div>
				<div className="col-span-2"><span className="text-sm text-muted-foreground">Area of Interest</span><div>{detail.area_of_interest || "-"}</div></div>
			</div>
			{detail.affiliation === "student" ? (
				<div className="grid grid-cols-2 gap-3">
					<div className="col-span-2"><span className="text-sm text-muted-foreground">University</span><div>{detail.university_name || "-"}</div></div>
					<div><span className="text-sm text-muted-foreground">Department</span><div>{detail.department || "-"}</div></div>
					<div><span className="text-sm text-muted-foreground">Roll #</span><div>{detail.roll_number || "-"}</div></div>
				</div>
			) : (
				<div className="grid grid-cols-2 gap-3">
					<div><span className="text-sm text-muted-foreground">Organization</span><div>{detail.organization || "-"}</div></div>
					<div><span className="text-sm text-muted-foreground">Role</span><div>{detail.role_title || "-"}</div></div>
				</div>
			)}
		<div className="grid grid-cols-2 gap-3">
			<div><span className="text-sm text-muted-foreground">Status</span><div>{detail.status}</div></div>
			<div><span className="text-sm text-muted-foreground">Reviewed</span><div>{formatDate(detail.reviewed_at)}</div></div>
			<div className="col-span-2"><span className="text-sm text-muted-foreground">Reason</span><div>{detail.decision_reason || "-"}</div></div>
			<div className="col-span-2"><span className="text-sm text-muted-foreground">Email</span><div className="text-xs">{detail.email || "-"}</div></div>
		</div>
		</div>
	);
};

const AdminTokenForm = ({ token, onSave, onClear }: { token: string; onSave: (v: string) => void; onClear: () => void }) => {
	const [value, setValue] = useState(token);
	return (
		<div className="space-y-4">
			<Input placeholder="Enter moderator token" value={value} onChange={(e) => setValue(e.target.value)} />
			<div className="flex justify-end gap-2">
				<Button variant="outline" onClick={onClear}>Clear</Button>
				<Button onClick={() => onSave(value)}>Save</Button>
			</div>
		</div>
	);
};

export default Admin;

const LoginForm = ({ onLogin }: { onLogin: (u: string, p: string) => void }) => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                onLogin(username, password);
            }}
            className="space-y-4"
        >
            <div>
                <label className="block text-sm mb-1">Username</label>
                <Input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Enter username" />
            </div>
            <div>
                <label className="block text-sm mb-1">Password</label>
                <Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter password" />
            </div>
            <div className="flex justify-end gap-2">
                <Button type="submit">Sign in</Button>
            </div>
        </form>
    );
};
