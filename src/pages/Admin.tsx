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

const [events, setEvents] = useState<any[]>([]);
const [eventsLoading, setEventsLoading] = useState(false);
const [attendanceEventId, setAttendanceEventId] = useState<string | null>(null);
const [attendanceData, setAttendanceData] = useState<any>(null);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authed, token]);

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
                        <TabsTrigger value="attendance">Attendance</TabsTrigger>
                        <TabsTrigger value="hackathons">Hackathons</TabsTrigger>
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

					<TabsContent value="attendance">
						<Card>
							<CardHeader>
								<CardTitle>Attendance Management</CardTitle>
								<CardDescription>Track registrations and check-ins for events in real time.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="flex flex-wrap items-center gap-3">
									<div className="min-w-[220px]">
										<Select value={attendanceEventId ?? ""} onValueChange={(value) => setAttendanceEventId(value)} disabled={eventsLoading || events.length === 0}>
											<SelectTrigger>
												<SelectValue placeholder={eventsLoading ? "Loading events..." : "Select event"} />
											</SelectTrigger>
											<SelectContent>
												{events.map((event) => (
													<SelectItem key={event.id} value={event.id}>
														{event.title}
													</SelectItem>
												))}
												{!events.length && !eventsLoading && <div className="px-2 py-1.5 text-sm text-muted-foreground">No events found</div>}
											</SelectContent>
										</Select>
									</div>
									<Button variant="outline" onClick={() => void loadEvents(true)} disabled={eventsLoading}>
										{eventsLoading ? "Refreshing..." : "Refresh Events"}
									</Button>
									<Button variant="outline" onClick={() => { setScannerOpen(true); setScannerPaused(false); setCheckinResult(null); }} disabled={!attendanceEventId || attendanceLoading}>
										Open QR Scanner
									</Button>
								</div>

								{attendanceLoading ? (
									<p className="text-sm text-muted-foreground">Loading attendance...</p>
								) : attendanceData && attendanceEventId ? (
									<>
										<div className="grid gap-4 sm:grid-cols-3">
											<Card>
												<CardHeader className="py-4">
													<CardTitle className="text-sm font-medium">Registered</CardTitle>
													<CardDescription className="text-2xl font-semibold text-foreground">{totalRegistered}</CardDescription>
												</CardHeader>
											</Card>
											<Card>
												<CardHeader className="py-4">
													<CardTitle className="text-sm font-medium">Checked-in</CardTitle>
													<CardDescription className="text-2xl font-semibold text-foreground">{totalCheckedIn}</CardDescription>
												</CardHeader>
											</Card>
											<Card>
												<CardHeader className="py-4">
													<CardTitle className="text-sm font-medium">Check-in Rate</CardTitle>
													<CardDescription className="text-2xl font-semibold text-foreground">{attendanceRate}%</CardDescription>
												</CardHeader>
											</Card>
										</div>

										<Card>
											<CardHeader>
												<CardTitle>Manual Check-In</CardTitle>
												<CardDescription>Enter a ShadowMesh code to mark attendance without scanning.</CardDescription>
											</CardHeader>
											<CardContent className="space-y-3">
												<form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleManualCheckIn}>
													<Input value={checkinCode} onChange={(e) => setCheckinCode(e.target.value.toUpperCase())} placeholder="SMXXXXXX" className="sm:w-64" maxLength={8} disabled={checkinLoading} />
													<Button type="submit" disabled={checkinLoading}>
														{checkinLoading ? "Checking..." : "Check In"}
													</Button>
												</form>
												{checkinResult && !scannerOpen && (
													<p className="text-xs text-muted-foreground">{checkinResult}</p>
												)}
											</CardContent>
										</Card>

										<div className="grid gap-6 lg:grid-cols-2">
											<Card>
												<CardHeader>
													<CardTitle>Registered Members ({registrations.length})</CardTitle>
													<CardDescription>RSVPs and approvals for this event.</CardDescription>
												</CardHeader>
												<CardContent>
													{registrations.length ? (
														<Table>
															<TableHeader>
																<TableRow>
																	<TableHead>Name</TableHead>
																	<TableHead>Email</TableHead>
																	<TableHead>Code</TableHead>
																	<TableHead>Registered</TableHead>
																	<TableHead>Status</TableHead>
																</TableRow>
															</TableHeader>
															<TableBody>
																{registrations.map((reg: any) => {
																	const attended = checkedMemberIds.has(reg.member_id);
																	return (
																		<TableRow key={reg.id} className={attended ? "bg-muted/50" : undefined}>
																		<TableCell>{reg.members?.full_name || "-"}</TableCell>
																		<TableCell>{reg.members?.email || "-"}</TableCell>
																		<TableCell><span className="font-mono text-xs">{reg.members?.secret_code || "-"}</span></TableCell>
																		<TableCell>{formatDate(reg.created_at)}</TableCell>
																		<TableCell>
																			<Badge variant={attended ? "secondary" : "outline"}>{attended ? "Checked-in" : reg.status}</Badge>
																		</TableCell>
																	</TableRow>
																);
															})}
															</TableBody>
														</Table>
													) : (
														<p className="text-sm text-muted-foreground">No registrations yet.</p>
													)}
												</CardContent>
											</Card>
											<Card>
												<CardHeader>
													<CardTitle>Recent Check-ins ({checkins.length})</CardTitle>
												</CardHeader>
												<CardContent>
													{checkins.length ? (
														<Table>
															<TableHeader>
																<TableRow>
																	<TableHead>When</TableHead>
																	<TableHead>Member</TableHead>
																	<TableHead>Method</TableHead>
																	<TableHead>Recorded By</TableHead>
																</TableRow>
															</TableHeader>
															<TableBody>
																{checkins.map((entry: any) => (
																	<TableRow key={entry.id}>
																		<TableCell>{formatDate(entry.created_at)}</TableCell>
																		<TableCell>
																			<div>{entry.members?.full_name || "-"}</div>
																			<div className="text-xs text-muted-foreground">{entry.members?.email || "-"}</div>
																		</TableCell>
																		<TableCell className="capitalize">{entry.method || "-"}</TableCell>
																		<TableCell>{entry.recorded_by || "-"}</TableCell>
																	</TableRow>
																))}
															</TableBody>
														</Table>
													) : (
														<p className="text-sm text-muted-foreground">No check-ins yet.</p>
													)}
												</CardContent>
											</Card>
										</div>
									</>
								) : (
									<p className="text-sm text-muted-foreground">Select an event to manage attendance.</p>
								)}
							</CardContent>
						</Card>

						<Dialog open={scannerOpen} onOpenChange={(open) => {
							setScannerOpen(open);
							if (!open) {
								scannerLockRef.current = false;
								setScannerPaused(false);
								setCheckinResult(null);
							}
						}}>
							<DialogContent className="max-w-xl">
								<DialogHeader>
									<DialogTitle>QR Check-In</DialogTitle>
									<DialogDescription>Scan ShadowMesh passes to mark attendance instantly.</DialogDescription>
								</DialogHeader>
								<div className="space-y-4">
									{attendanceEventId ? (
										<div className="space-y-3">
											<QrScanner
												key={attendanceEventId}
												onDecode={(value) => {
													if (!value || scannerPaused) return;
													void handleScannerDecode(value);
												}}
												onError={(error) => console.error(error)}
												constraints={{ facingMode: "environment" }}
												containerStyle={{ width: "100%" }}
												videoStyle={{ width: "100%" }}
											/>
											<Button variant="outline" onClick={() => { scannerLockRef.current = false; setScannerPaused(false); }} disabled={!scannerPaused}>
												Resume scanner
											</Button>
										</div>
									) : (
										<p className="text-sm text-muted-foreground">Select an event before scanning.</p>
									)}
									{checkinResult && (
										<p className="text-xs text-muted-foreground">{checkinResult}</p>
									)}
								</div>
							</DialogContent>
						</Dialog>
					</TabsContent>

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
				</Tabs>
			</div>

			<Dialog open={openDetail} onOpenChange={setOpenDetail}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Application Details</DialogTitle>
					</DialogHeader>
					<DetailView detail={detail} />
					<DialogFooter>
						<Button variant="outline" onClick={() => setOpenDetail(false)}>Close</Button>
						{detail && detail.status === "pending" && (
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
