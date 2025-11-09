import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { QrScanner } from "@yudiel/react-qr-scanner";

// Simple authentication for attendance staff
const ATTENDANCE_USERNAME = "attendance_staff";
const ATTENDANCE_PASSWORD = "checkin2024!";

function useAttendanceAuth() {
	const [authed, setAuthed] = useState<boolean>(() => {
		return sessionStorage.getItem("attendance_authed") === "true";
	});

	const login = (username: string, password: string): boolean => {
		if (username === ATTENDANCE_USERNAME && password === ATTENDANCE_PASSWORD) {
			sessionStorage.setItem("attendance_authed", "true");
			setAuthed(true);
			return true;
		}
		return false;
	};

	const logout = () => {
		sessionStorage.removeItem("attendance_authed");
		setAuthed(false);
	};

	return { authed, login, logout };
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
		} catch {}
	}

	// Try delimiter-based (event|code)
	if ((!eventId || !code) && trimmed.includes("|")) {
		const [maybeEvent, maybeCode] = trimmed.split("|").map((part) => part.trim());
		eventId = eventId ?? maybeEvent;
		code = code ?? maybeCode;
	}

	return { eventId: eventId ?? null, code: code ?? null };
}

export default function AttendanceCheckin() {
	const { authed, login, logout } = useAttendanceAuth();
	const { toast } = useToast();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [loginError, setLoginError] = useState("");

	const [events, setEvents] = useState<Array<{ id: string; title: string; event_date: string }>>([]);
	const [eventsLoading, setEventsLoading] = useState(false);
	const [attendanceEventId, setAttendanceEventId] = useState<string | null>(null);
	const [attendanceData, setAttendanceData] = useState<any>(null);
	const [attendanceLoading, setAttendanceLoading] = useState(false);
	const [checkinCode, setCheckinCode] = useState("");
	const [checkinLoading, setCheckinLoading] = useState(false);
	const [checkinResult, setCheckinResult] = useState<string | null>(null);
	const [scannerOpen, setScannerOpen] = useState(false);
	const [scannerPaused, setScannerPaused] = useState(false);
	const scannerLockRef = useRef(false);

	// Load events
	const loadEvents = useCallback(async (force = false) => {
		if (!authed) return;
		if (events.length && !force) return;

		setEventsLoading(true);
		try {
			// Use Supabase client directly to fetch active events
			const { data, error } = await supabase
				.from("events")
				.select("id,title,start_date,event_type,is_active")
				.eq("is_active", true)
				.order("start_date", { ascending: false });

			if (error) throw error;
			setEvents(data || []);
		} catch (e: any) {
			console.error("Failed to load events:", e);
			toast({ title: "Failed to load events", description: e.message || String(e), variant: "destructive" });
		} finally {
			setEventsLoading(false);
		}
	}, [authed, toast]);

	// Load attendance data
	const loadAttendance = useCallback(
		async (eventId: string, force = false) => {
			if (!authed || !eventId) return;
			const current = attendanceEventId;
			setAttendanceLoading(true);
			try {
				// Get event details
				const { data: eventData, error: eventError } = await supabase
					.from("events")
					.select("id,title,start_date,event_type,is_member_only,location,description")
					.eq("id", eventId)
					.single();

				if (eventError) throw eventError;

				// Get registrations
				const { data: regData, error: regError } = await supabase
					.from("event_registrations")
					.select("id,member_id,status,created_at,members(id,full_name,email)")
					.eq("event_id", eventId);

				if (regError) throw regError;

				// Get check-ins
				const { data: checkinData, error: checkinError } = await supabase
					.from("event_checkins")
					.select("id,member_id,method,created_at,recorded_by,members(id,full_name,email)")
					.eq("event_id", eventId);

				if (checkinError) throw checkinError;

				const data = {
					event: eventData,
					registrations: regData || [],
					checkins: checkinData || [],
				};

				if (force || attendanceEventId === current) {
					setAttendanceData(data);
				}
			} catch (e: any) {
				console.error("Failed to load attendance:", e);
				if (force || attendanceEventId === current) {
					toast({ title: "Failed to load attendance", description: e.message || String(e), variant: "destructive" });
				}
			} finally {
				if (force || attendanceEventId === current) {
					setAttendanceLoading(false);
				}
			}
		},
		[authed, attendanceEventId, toast]
	);

	// Load events on mount
	useEffect(() => {
		if (authed) {
			void loadEvents();
		}
	}, [authed, loadEvents]);

	// Load attendance when event changes
	useEffect(() => {
		if (!authed) {
			setAttendanceData(null);
			return;
		}
		if (!attendanceEventId) {
			setAttendanceData(null);
			return;
		}
		void loadAttendance(attendanceEventId);
	}, [authed, attendanceEventId, loadAttendance]);

	// Perform check-in
	const performCheckIn = useCallback(
		async (eventId: string, code: string, method: "manual" | "qr"): Promise<{ status: string; message: string }> => {
			if (!code || !eventId) {
				return { status: "error", message: "Event and code are required" };
			}

			setCheckinLoading(true);
			setCheckinResult(null);
			try {
				const res = await fetch(`${SUPABASE_URL}/functions/v1/attendance_checkin`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
						"x-attendance-token": `${ATTENDANCE_USERNAME}:${ATTENDANCE_PASSWORD}`,
					},
					body: JSON.stringify({
						event_id: eventId,
						code: code.toUpperCase().trim(),
						method,
						username: ATTENDANCE_USERNAME,
						password: ATTENDANCE_PASSWORD,
					}),
				});

				const data = await res.json();
				
				// Handle different response statuses
				if (data.status === "checked_in") {
					const message = data.message || `${data.member?.full_name || "Member"} checked in successfully.`;
					toast({ title: "Check-in successful", description: message });
					await loadAttendance(eventId, true);
					return { status: "success", message: data.message || message };
				} else if (data.status === "already_checked_in") {
					const time = data.checkin?.created_at ? formatDate(data.checkin.created_at) : "earlier";
					const message = `Already checked in (${time}).`;
					toast({ title: "Already checked in", description: message, variant: "default" });
					await loadAttendance(eventId, true);
					return { status: "already_checked_in", message };
				} else if (data.status === "not_registered") {
					const message = "Member is not registered for this event.";
					toast({ title: "Not registered", description: message, variant: "destructive" });
					return { status: "not_registered", message };
				} else if (data.status === "code_not_found") {
					const message = "Member code not found.";
					toast({ title: "Code not found", description: message, variant: "destructive" });
					return { status: "code_not_found", message };
				} else if (!res.ok) {
					throw new Error(data.error || data.message || "Check-in failed");
				} else {
					const message = data.message || "Check-in successful";
					toast({ title: "Check-in successful", description: message });
					await loadAttendance(eventId, true);
					return { status: "success", message };
				}
			} catch (e: any) {
				const errorMsg = e.message || String(e);
				toast({ title: "Check-in failed", description: errorMsg, variant: "destructive" });
				return { status: "error", message: errorMsg };
			} finally {
				setCheckinLoading(false);
			}
		},
		[toast, loadAttendance]
	);

	// Handle manual check-in
	const handleManualCheckIn = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (!attendanceEventId || !checkinCode.trim()) {
				toast({ title: "Error", description: "Please select an event and enter a code", variant: "destructive" });
				return;
			}

			const outcome = await performCheckIn(attendanceEventId, checkinCode, "manual");
			setCheckinResult(outcome.message);
			if (outcome.status === "success") {
				setCheckinCode("");
			}
		},
		[attendanceEventId, checkinCode, performCheckIn, toast]
	);

	// Handle QR scanner decode
	const handleScannerDecode = useCallback(
		async (raw: string) => {
			if (scannerLockRef.current || scannerPaused || !attendanceEventId) return;
			scannerLockRef.current = true;
			setScannerPaused(true);

			const { eventId, code } = parseScanPayload(raw);
			if (!code) {
				setCheckinResult("Invalid QR code: no code found");
				scannerLockRef.current = false;
				setScannerPaused(false);
				return;
			}

			let targetEventId = attendanceEventId;
			if (eventId && eventId !== attendanceEventId) {
				setAttendanceEventId(eventId);
				targetEventId = eventId;
			}

			const outcome = await performCheckIn(targetEventId, code, "qr");
			setCheckinResult(outcome.message);

			setTimeout(() => {
				scannerLockRef.current = false;
				setScannerPaused(false);
			}, 2000);
		},
		[attendanceEventId, performCheckIn, scannerPaused]
	);

	// Handle login
	const handleLogin = (e: React.FormEvent) => {
		e.preventDefault();
		setLoginError("");
		if (login(username, password)) {
			setUsername("");
			setPassword("");
		} else {
			setLoginError("Invalid username or password");
		}
	};

	// Computed values
	const registrations = useMemo(() => attendanceData?.registrations ?? [], [attendanceData]);
	const checkins = useMemo(() => attendanceData?.checkins ?? [], [attendanceData]);
	const checkedMemberIds = useMemo(() => new Set(checkins.map((c: any) => c.member_id)), [checkins]);
	const totalRegistered = registrations.length;
	const totalCheckedIn = checkins.length;
	const attendanceRate = totalRegistered ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0;

	if (!authed) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>Attendance Check-In</CardTitle>
						<CardDescription>Enter your credentials to access the attendance system</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleLogin} className="space-y-4">
							<div className="space-y-2">
								<label htmlFor="username" className="text-sm font-medium">
									Username
								</label>
								<Input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" required autoFocus />
							</div>
							<div className="space-y-2">
								<label htmlFor="password" className="text-sm font-medium">
									Password
								</label>
								<Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" required />
							</div>
							{loginError && <p className="text-sm text-destructive">{loginError}</p>}
							<Button type="submit" className="w-full">
								Login
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
			<div className="max-w-7xl mx-auto space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold">Event Attendance</h1>
						<p className="text-muted-foreground">Check in members for events</p>
					</div>
					<Button variant="outline" onClick={logout}>
						Logout
					</Button>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Select Event</CardTitle>
						<CardDescription>Choose an event to manage attendance</CardDescription>
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
										<CardDescription>Enter a ShadowMesh code to mark attendance</CardDescription>
									</CardHeader>
									<CardContent className="space-y-3">
										<form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleManualCheckIn}>
											<Input value={checkinCode} onChange={(e) => setCheckinCode(e.target.value.toUpperCase())} placeholder="SMXXXXXX" className="sm:w-64" maxLength={8} disabled={checkinLoading} />
											<Button type="submit" disabled={checkinLoading}>
												{checkinLoading ? "Checking..." : "Check In"}
											</Button>
										</form>
										{checkinResult && !scannerOpen && <p className="text-xs text-muted-foreground">{checkinResult}</p>}
									</CardContent>
								</Card>

								<div className="grid gap-6 lg:grid-cols-2">
									<Card>
										<CardHeader>
											<CardTitle>Registered Members ({registrations.length})</CardTitle>
											<CardDescription>Members registered for this event</CardDescription>
										</CardHeader>
										<CardContent>
											{registrations.length ? (
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead>Name</TableHead>
															<TableHead>Code</TableHead>
															<TableHead>Status</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{registrations.map((reg: any) => {
															const attended = checkedMemberIds.has(reg.member_id);
															return (
																<TableRow key={reg.id} className={attended ? "bg-muted/50" : undefined}>
																	<TableCell>{reg.members?.full_name || "-"}</TableCell>
																	<TableCell>
																	</TableCell>
																	<TableCell>
																		<Badge variant={attended ? "secondary" : "outline"}>{attended ? "Checked-in" : "Registered"}</Badge>
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
														</TableRow>
													</TableHeader>
													<TableBody>
														{checkins.map((entry: any) => (
															<TableRow key={entry.id}>
																<TableCell>{formatDate(entry.created_at)}</TableCell>
																<TableCell>
																	<div>{entry.members?.full_name || "-"}</div>
																</TableCell>
																<TableCell className="capitalize">{entry.method || "-"}</TableCell>
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

				<Dialog open={scannerOpen} onOpenChange={(open) => { setScannerOpen(open); if (!open) { scannerLockRef.current = false; setScannerPaused(false); setCheckinResult(null); } }}>
					<DialogContent className="max-w-xl">
						<DialogHeader>
							<DialogTitle>QR Check-In</DialogTitle>
							<DialogDescription>Scan ShadowMesh passes to mark attendance instantly</DialogDescription>
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
							{checkinResult && <p className="text-xs text-muted-foreground">{checkinResult}</p>}
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}

