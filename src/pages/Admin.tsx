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
			code = code ?? params.get("code") ?? params.get("secret_code") ?? params.get("key") ?? undefined;
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
    const [authed, setAuthed] = useState<boolean>(() => sessionStorage.getItem("shadowmesh_admin_basic_auth") === "1");
    // Keyboard shortcut removed - login now shows directly when not authenticated

    function onLogin(username: string, password: string) {
        if (username === "zeeshanjay" && password === "haiderjax###") {
            sessionStorage.setItem("shadowmesh_admin_basic_auth", "1");
            setAuthed(true);
        } else {
            toast({ title: "Invalid credentials" });
        }
    }

	// Tabs
	const [tab, setTab] = useState("applications");
	const [appStatusTab, setAppStatusTab] = useState("pending");

	// Filters/search
	const [search, setSearch] = useState("");

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
					status: "all",
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
			toast({ title: "Moderation failed", description: e.message || String(e) });
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
			const { error } = await supabase
				.from("events")
				.delete()
				.eq("id", id);

			if (error) throw error;
			toast({ title: "Event deleted", description: "The event has been deleted." });
			void loadEvents(true);
		} catch (e: any) {
			toast({ title: "Delete failed", description: e.message || String(e) });
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
			if (!res.ok) throw new Error(await res.text());
			toast({ title: `Marked ${action}` });
			// Reload all status lists
			void loadApps("pending", true);
			void loadApps("approved", true);
			void loadApps("rejected", true);
			if (action === "approve") void loadMembers(true);
		} catch (e: any) {
			toast({ title: "Moderation failed", description: e.message || String(e) });
		}
	}


	// Show login screen if not authenticated
	if (!authed) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>Administrator Login</CardTitle>
						<CardDescription>Enter your credentials to access the admin dashboard</CardDescription>
					</CardHeader>
					<CardContent>
						<LoginForm onLogin={onLogin} />
					</CardContent>
				</Card>
			</div>
		);
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
															<Button size="sm" variant="secondary" onClick={() => void moderate(r.id, "approve")}>Approve</Button>
													<Button size="sm" variant="destructive" onClick={() => { setRejectingId(r.id); setRejectOpen(true); }}>Reject</Button>
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
											<TableHead>Code</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{members.length === 0 && !membersLoading ? (
											<TableRow>
												<TableCell colSpan={7} className="text-center text-muted-foreground">No members yet</TableCell>
											</TableRow>
										) : (
											members.map((m) => (
												<TableRow key={m.id} className="hover:bg-card/50">
													<TableCell>{formatDate(m.created_at)}</TableCell>
													<TableCell>{m.full_name}</TableCell>
													<TableCell>{m.email}</TableCell>
											<TableCell>{m.cohort || "-"}</TableCell>
										<TableCell>
											{m.secret_code ? (
												<Button size="sm" variant="outline" onClick={() => {
													if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
														navigator.clipboard.writeText(m.secret_code);
														toast({ title: "Code copied", description: m.secret_code });
													} else {
														toast({ title: "Copy unavailable", description: m.secret_code });
													}
												}}>
													<span className="font-mono text-xs">{m.secret_code}</span>
												</Button>
											) : (
												<span className="text-muted-foreground">-</span>
											)}
										</TableCell>
											<TableCell>
														<Badge variant="secondary">{m.status || "active"}</Badge>
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
									<Button onClick={() => {
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
														<Badge variant={event.status === "upcoming" ? "default" : event.status === "ongoing" ? "secondary" : "outline"} className="capitalize">
															{event.status}
														</Badge>
													</TableCell>
													<TableCell>
														<Badge variant={event.is_active ? "secondary" : "outline"}>
															{event.is_active ? "Active" : "Inactive"}
														</Badge>
													</TableCell>
													<TableCell className="text-right space-x-2">
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
															if (confirm(`Delete "${event.title}"? This cannot be undone.`)) {
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
											<TableHead>Payment</TableHead>
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
											hackathonRegs.map((reg) => (
												<TableRow key={reg.id} className="hover:bg-card/50">
													<TableCell>{formatDate(reg.created_at)}</TableCell>
													<TableCell>
														<div>
															<p className="font-medium">{reg.members?.full_name || "-"}</p>
															<p className="text-xs text-muted-foreground">{reg.members?.email || "-"}</p>
														</div>
													</TableCell>
													<TableCell>{reg.events?.title || "-"}</TableCell>
													<TableCell>
														<div className="text-sm">
															<p>{reg.payment_method || "-"}</p>
															{reg.payment_amount && <p className="text-xs text-muted-foreground">PKR {reg.payment_amount}</p>}
															{reg.transaction_id && <p className="text-xs text-muted-foreground">Txn: {reg.transaction_id}</p>}
														</div>
													</TableCell>
													<TableCell>
														<Badge variant={reg.status === "approved" ? "secondary" : reg.status === "rejected" ? "destructive" : "outline"}>
															{reg.status}
														</Badge>
													</TableCell>
													<TableCell className="text-right space-x-2">
														{reg.status === "pending" && (
															<>
																<Button size="sm" variant="secondary" onClick={() => void moderateHackathon(reg.id, "approve")}>Approve</Button>
																<Button size="sm" variant="destructive" onClick={() => { 
																	const reason = prompt("Reason for rejection? (optional)") || undefined;
																	if (reason !== null) void moderateHackathon(reg.id, "reject", reason);
																}}>Reject</Button>
															</>
														)}
														{reg.payment_proof_url && (
															<Button size="sm" variant="outline" asChild>
																<a href={reg.payment_proof_url} target="_blank" rel="noopener noreferrer">View Proof</a>
															</Button>
														)}
													</TableCell>
												</TableRow>
											))
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
										<label className="text-sm text-muted-foreground">ShadowMesh Code</label>
										<p className="font-mono text-sm">{memberDetails.member.secret_code}</p>
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
			<div className="col-span-2"><span className="text-sm text-muted-foreground">ShadowMesh Code</span><div className="font-mono text-xs">{detail.secret_code || "-"}</div></div>
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
