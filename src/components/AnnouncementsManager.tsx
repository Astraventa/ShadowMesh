import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Megaphone, Plus, Edit, Trash2, ExternalLink } from "lucide-react";

export default function AnnouncementsManager() {
	const { toast } = useToast();
	const [announcements, setAnnouncements] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [editing, setEditing] = useState<any | null>(null);
	const [formData, setFormData] = useState({
		title: "",
		link: "",
		description: "",
		display_position: "top",
		animation_type: "pulse",
		priority: 0,
		expires_at: "",
		is_active: true,
	});

	useEffect(() => {
		loadAnnouncements();
	}, []);

	async function loadAnnouncements() {
		setLoading(true);
		try {
			// Auto deactivate expired announcements
			const nowIso = new Date().toISOString();
			await supabase
				.from("global_announcements")
				.update({ is_active: false })
				.eq("is_active", true)
				.not("expires_at", "is", null)
				.lte("expires_at", nowIso);

			const { data, error } = await supabase
				.from("global_announcements")
				.select("*")
				.order("priority", { ascending: false })
				.order("created_at", { ascending: false });
			if (error) throw error;
			setAnnouncements(data || []);
		} catch (e: any) {
			toast({ title: "Error", description: e.message, variant: "destructive" });
		} finally {
			setLoading(false);
		}
	}

	async function saveAnnouncement() {
		try {
			const data = {
				...formData,
				expires_at: formData.expires_at || null,
				created_by: "admin",
			};
			if (editing) {
				const { error } = await supabase
					.from("global_announcements")
					.update(data)
					.eq("id", editing.id);
				if (error) throw error;
				toast({ title: "Success", description: "Announcement updated" });
			} else {
				const { error } = await supabase
					.from("global_announcements")
					.insert(data);
				if (error) throw error;
				toast({ title: "Success", description: "Announcement created" });
			}
			setShowForm(false);
			setEditing(null);
			setFormData({
				title: "",
				link: "",
				description: "",
				display_position: "top",
				animation_type: "pulse",
				priority: 0,
				expires_at: "",
				is_active: true,
			});
			loadAnnouncements();
		} catch (e: any) {
			toast({ title: "Error", description: e.message, variant: "destructive" });
		}
	}

	async function deleteAnnouncement(id: string) {
		if (!confirm("Delete this announcement?")) return;
		try {
			const { error } = await supabase
				.from("global_announcements")
				.delete()
				.eq("id", id);
			if (error) throw error;
			toast({ title: "Success", description: "Announcement deleted" });
			loadAnnouncements();
		} catch (e: any) {
			toast({ title: "Error", description: e.message, variant: "destructive" });
		}
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<Megaphone className="w-5 h-5" />
						Announcements Management
					</CardTitle>
					<Button onClick={() => {
						setEditing(null);
						setFormData({
							title: "",
							link: "",
							description: "",
							display_position: "top",
							animation_type: "pulse",
							priority: 0,
							expires_at: "",
							is_active: true,
						});
						setShowForm(true);
					}}>
						<Plus className="w-4 h-4 mr-2" />
						New Announcement
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{loading ? (
					<div className="text-center py-8">Loading...</div>
				) : announcements.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground">No announcements yet</div>
				) : (
					<div className="space-y-3">
						{announcements.map((ann) => (
							<div key={ann.id} className="p-4 border rounded-lg">
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-2 mb-2">
											<h3 className="font-semibold">{ann.title}</h3>
											<Badge variant={ann.is_active ? "default" : "secondary"}>
												{ann.is_active ? "Active" : "Inactive"}
											</Badge>
											<Badge variant="outline">{ann.display_position}</Badge>
											<Badge variant="outline">{ann.animation_type}</Badge>
										</div>
										{ann.description && <p className="text-sm text-muted-foreground mb-2">{ann.description}</p>}
										{ann.link && (
											<a href={ann.link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1">
												<ExternalLink className="w-3 h-3" />
												{ann.link}
											</a>
										)}
										<div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
											<span>Priority: {ann.priority}</span>
											{ann.expires_at && <span>Expires: {new Date(ann.expires_at).toLocaleDateString()}</span>}
										</div>
									</div>
									<div className="flex gap-2">
										<Button size="sm" variant="outline" onClick={() => {
											setEditing(ann);
											setFormData({
												title: ann.title,
												link: ann.link || "",
												description: ann.description || "",
												display_position: ann.display_position,
												animation_type: ann.animation_type,
												priority: ann.priority,
												expires_at: ann.expires_at ? new Date(ann.expires_at).toISOString().slice(0, 16) : "",
												is_active: ann.is_active,
											});
											setShowForm(true);
										}}>
											<Edit className="w-3 h-3" />
										</Button>
										<Button size="sm" variant="destructive" onClick={() => deleteAnnouncement(ann.id)}>
											<Trash2 className="w-3 h-3" />
										</Button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>

			<Dialog open={showForm} onOpenChange={setShowForm}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{editing ? "Edit Announcement" : "New Announcement"}</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div>
							<label className="text-sm font-medium">Title *</label>
							<Input
								value={formData.title}
								onChange={(e) => setFormData({ ...formData, title: e.target.value })}
								placeholder="e.g., Join our WhatsApp Community"
							/>
						</div>
						<div>
							<label className="text-sm font-medium">Link</label>
							<Input
								value={formData.link}
								onChange={(e) => setFormData({ ...formData, link: e.target.value })}
								placeholder="https://..."
							/>
						</div>
						<div>
							<label className="text-sm font-medium">Description</label>
							<Textarea
								value={formData.description}
								onChange={(e) => setFormData({ ...formData, description: e.target.value })}
								placeholder="Optional description"
								rows={3}
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="text-sm font-medium">Display Position</label>
								<Select value={formData.display_position} onValueChange={(v) => setFormData({ ...formData, display_position: v })}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="top">Top</SelectItem>
										<SelectItem value="bottom">Bottom</SelectItem>
										<SelectItem value="sidebar">Sidebar</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<label className="text-sm font-medium">Animation</label>
								<Select value={formData.animation_type} onValueChange={(v) => setFormData({ ...formData, animation_type: v })}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="pulse">Pulse</SelectItem>
										<SelectItem value="bounce">Bounce</SelectItem>
										<SelectItem value="shake">Shake</SelectItem>
										<SelectItem value="glow">Glow</SelectItem>
										<SelectItem value="none">None</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="text-sm font-medium">Priority (0-100)</label>
								<Input
									type="number"
									min="0"
									max="100"
									value={formData.priority}
									onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
								/>
							</div>
							<div>
								<label className="text-sm font-medium">Expires At (optional)</label>
								<Input
									type="datetime-local"
									value={formData.expires_at}
									onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
								/>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={formData.is_active}
								onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
								className="rounded"
							/>
							<label className="text-sm font-medium">Active</label>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => {
							setShowForm(false);
							setEditing(null);
						}}>Cancel</Button>
						<Button onClick={() => void saveAnnouncement()}>Save</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

