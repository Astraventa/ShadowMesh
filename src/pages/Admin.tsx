import { useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

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

	// Tabs
	const [tab, setTab] = useState("applications");

	// Filters/search
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<string>("all");

	// Data state
	const [apps, setApps] = useState<JoinRow[]>([]);
	const [appsHasMore, setAppsHasMore] = useState(true);
	const [appsLoading, setAppsLoading] = useState(false);

	const [msgs, setMsgs] = useState<MessageRow[]>([]);
	const [msgsHasMore, setMsgsHasMore] = useState(true);
	const [msgsLoading, setMsgsLoading] = useState(false);

	// Detail dialog
	const [openDetail, setOpenDetail] = useState(false);
	const [detail, setDetail] = useState<JoinRow | null>(null);

	// Initial loads
	useEffect(() => {
		void loadApps(true);
		void loadMsgs(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Realtime subscriptions to refresh lists
	useEffect(() => {
		const channel = supabase
			.channel("admin-realtime")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "join_applications" },
				() => void loadApps(true)
			)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "contact_messages" },
				() => void loadMsgs(true)
			)
			.subscribe();
		return () => {
			void supabase.removeChannel(channel);
		};
	}, []);

	async function loadApps(reset = false) {
		if (appsLoading) return;
		setAppsLoading(true);
		try {
			const from = reset ? 0 : apps.length;
			const to = from + PAGE_SIZE - 1;
			let query = supabase
				.from("join_applications")
				.select(
					"id, created_at, status, full_name, email, affiliation, area_of_interest, university_name, department, roll_number, organization, role_title, phone_e164, raw_phone, verification_token, reviewed_at, reviewed_by, decision_reason",
					{ count: "exact" }
				)
				.order("created_at", { ascending: false })
				.range(from, to);
			if (status !== "all") query = query.eq("status", status);
			if (search.trim()) {
				// Basic case-insensitive search over a few columns
				const s = `%${search.trim()}%`;
				query = query.or(
					`full_name.ilike.${s},email.ilike.${s},university_name.ilike.${s},organization.ilike.${s},role_title.ilike.${s}`
				);
			}
			const { data, error } = await query;
			if (error) throw error;
			setApps((prev) => (reset ? data ?? [] : [...prev, ...(data ?? [])]));
			setAppsHasMore((data?.length ?? 0) === PAGE_SIZE);
		} catch (e: any) {
			toast({ title: "Failed to load applications", description: e.message || String(e) });
		} finally {
			setAppsLoading(false);
		}
	}

	async function loadMsgs(reset = false) {
		if (msgsLoading) return;
		setMsgsLoading(true);
		try {
			const from = reset ? 0 : msgs.length;
			const to = from + PAGE_SIZE - 1;
			let query = supabase
				.from("contact_messages")
				.select("id, created_at, name, email, message, phone_e164, raw_phone, source_page, user_agent")
				.order("created_at", { ascending: false })
				.range(from, to);
			if (search.trim()) {
				const s = `%${search.trim()}%`;
				query = query.or(`name.ilike.${s},email.ilike.${s},message.ilike.${s}`);
			}
			const { data, error } = await query;
			if (error) throw error;
			setMsgs((prev) => (reset ? data ?? [] : [...prev, ...(data ?? [])]));
			setMsgsHasMore((data?.length ?? 0) === PAGE_SIZE);
		} catch (e: any) {
			toast({ title: "Failed to load messages", description: e.message || String(e) });
		} finally {
			setMsgsLoading(false);
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
			void loadApps(true);
		} catch (e: any) {
			toast({ title: "Moderation failed", description: e.message || String(e) });
		}
	}

	const filteredApps = useMemo(() => apps, [apps]);
	const filteredMsgs = useMemo(() => msgs, [msgs]);

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
									void loadApps(true);
									void loadMsgs(true);
								}, 300);
							}}
							className="w-80"
						/>
						<Select value={status} onValueChange={(v) => { setStatus(v); void loadApps(true); }}>
							<SelectTrigger className="w-40">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
								<SelectItem value="approved">Approved</SelectItem>
								<SelectItem value="rejected">Rejected</SelectItem>
							</SelectContent>
						</Select>
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
					</TabsList>

					<TabsContent value="applications">
						<Card>
							<CardHeader>
								<CardTitle>Applications</CardTitle>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>When</TableHead>
											<TableHead>Name</TableHead>
											<TableHead>Email</TableHead>
											<TableHead>Affiliation</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredApps.map((r) => (
											<TableRow key={r.id} className="hover:bg-card/50">
												<TableCell>{formatDate(r.created_at)}</TableCell>
												<TableCell>{r.full_name}</TableCell>
												<TableCell>{r.email}</TableCell>
												<TableCell className="capitalize">{r.affiliation}</TableCell>
												<TableCell>
													<Badge variant={r.status === "approved" ? "secondary" : r.status === "rejected" ? "destructive" : "outline"}>{r.status}</Badge>
												</TableCell>
												<TableCell className="text-right space-x-2">
													<Button size="sm" variant="outline" onClick={() => { setDetail(r); setOpenDetail(true); }}>View</Button>
													<Button size="sm" variant="secondary" disabled={r.status !== "pending"} onClick={() => void moderate(r.id, "approve")}>Approve</Button>
													<Button size="sm" variant="destructive" disabled={r.status !== "pending"} onClick={() => {
														const reason = prompt("Reason for rejection? (optional)") || undefined;
														void moderate(r.id, "reject", reason);
													}}>Reject</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
								<div className="flex justify-center mt-4">
									<Button variant="outline" disabled={!appsHasMore || appsLoading} onClick={() => void loadApps(false)}>
										{appsLoading ? "Loading..." : appsHasMore ? "Load more" : "No more"}
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
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredMsgs.map((m) => (
											<TableRow key={m.id} className="hover:bg-card/50">
												<TableCell>{formatDate(m.created_at)}</TableCell>
												<TableCell>{m.name}</TableCell>
												<TableCell>{m.email}</TableCell>
												<TableCell className="max-w-[520px] truncate" title={m.message}>{m.message}</TableCell>
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
					{detail && (
						<div className="space-y-3">
							<div className="grid grid-cols-2 gap-3">
								<div><span className="text-sm text-muted-foreground">Name</span><div>{detail.full_name}</div></div>
								<div><span className="text-sm text-muted-foreground">Email</span><div>{detail.email}</div></div>
								<div><span className="text-sm text-muted-foreground">Affiliation</span><div className="capitalize">{detail.affiliation}</div></div>
								<div><span className="text-sm text-muted-foreground">Phone</span><div>{detail.phone_e164 || detail.raw_phone || "-"}</div></div>
								<div className="col-span-2"><span className="text-sm text-muted-foreground">Area of Interest</span><div>{detail.area_of_interest || "-"}</div></div>
								{detail.affiliation === "student" ? (
									<>
										<div className="col-span-2"><span className="text-sm text-muted-foreground">University</span><div>{detail.university_name || "-"}</div></div>
										<div><span className="text-sm text-muted-foreground">Department</span><div>{detail.department || "-"}</div></div>
										<div><span className="text-sm text-muted-foreground">Roll #</span><div>{detail.roll_number || "-"}</div></div>
									</>
								) : (
									<>
										<div><span className="text-sm text-muted-foreground">Organization</span><div>{detail.organization || "-"}</div></div>
										<div><span className="text-sm text-muted-foreground">Role</span><div>{detail.role_title || "-"}</div></div>
									</>
								)}
								<div className="grid grid-cols-2 gap-3">
									<div><span className="text-sm text-muted-foreground">Status</span><div>{detail.status}</div></div>
									<div><span className="text-sm text-muted-foreground">Reviewed</span><div>{formatDate(detail.reviewed_at)}</div></div>
									<div className="col-span-2"><span className="text-sm text-muted-foreground">Reason</span><div>{detail.decision_reason || "-"}</div></div>
									<div className="col-span-2"><span className="text-sm text-muted-foreground">Verification Token</span><div className="break-all text-xs">{detail.verification_token || "-"}</div></div>
								</div>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setOpenDetail(false)}>Close</Button>
						{detail && detail.status === "pending" && (
							<>
								<Button variant="secondary" onClick={() => { void moderate(detail.id, "approve"); }}>Approve</Button>
								<Button variant="destructive" onClick={() => { const reason = prompt("Reason for rejection? (optional)") || undefined; void moderate(detail.id, "reject", reason); }}>Reject</Button>
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
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
