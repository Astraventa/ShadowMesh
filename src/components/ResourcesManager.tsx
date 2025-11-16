import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { BookOpen, Plus, Edit, Trash2 } from "lucide-react";

export default function ResourcesManager() {
	const { toast } = useToast();
	const [resources, setResources] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [editing, setEditing] = useState<any | null>(null);
	const [formData, setFormData] = useState({
		title: "",
		description: "",
		resource_type: "link",
		content_url: "",
		access_level: "all",
		display_order: 0,
		is_active: true,
		tags: [] as string[],
	});

	useEffect(() => {
		loadResources();
	}, []);

	async function loadResources() {
		setLoading(true);
		try {
			const { data, error } = await supabase
				.from("global_resources")
				.select("*")
				.order("display_order", { ascending: true });
			if (error) throw error;
			setResources(data || []);
		} catch (e: any) {
			toast({ title: "Error", description: e.message, variant: "destructive" });
		} finally {
			setLoading(false);
		}
	}

	async function saveResource() {
		try {
			const data = {
				...formData,
				created_by: "admin",
			};
			if (editing) {
				const { error } = await supabase
					.from("global_resources")
					.update(data)
					.eq("id", editing.id);
				if (error) throw error;
				toast({ title: "Success", description: "Resource updated" });
			} else {
				const { error } = await supabase
					.from("global_resources")
					.insert(data);
				if (error) throw error;
				toast({ title: "Success", description: "Resource created" });
			}
			setShowForm(false);
			setEditing(null);
			setFormData({
				title: "",
				description: "",
				resource_type: "link",
				content_url: "",
				access_level: "all",
				display_order: 0,
				is_active: true,
				tags: [],
			});
			loadResources();
		} catch (e: any) {
			toast({ title: "Error", description: e.message, variant: "destructive" });
		}
	}

	async function deleteResource(id: string) {
		if (!confirm("Delete this resource?")) return;
		try {
			const { error } = await supabase
				.from("global_resources")
				.delete()
				.eq("id", id);
			if (error) throw error;
			toast({ title: "Success", description: "Resource deleted" });
			loadResources();
		} catch (e: any) {
			toast({ title: "Error", description: e.message, variant: "destructive" });
		}
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<BookOpen className="w-5 h-5" />
						Global Resources Management
					</CardTitle>
					<Button onClick={() => {
						setEditing(null);
						setFormData({
							title: "",
							description: "",
							resource_type: "link",
							content_url: "",
							access_level: "all",
							display_order: 0,
							is_active: true,
							tags: [],
						});
						setShowForm(true);
					}}>
						<Plus className="w-4 h-4 mr-2" />
						New Resource
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{loading ? (
					<div className="text-center py-8">Loading...</div>
				) : resources.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground">No resources yet</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Order</TableHead>
								<TableHead>Title</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Access</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{resources.map((res) => (
								<TableRow key={res.id}>
									<TableCell>{res.display_order}</TableCell>
									<TableCell>
										<div>
											<div className="font-medium">{res.title}</div>
											{res.description && <div className="text-xs text-muted-foreground">{res.description}</div>}
										</div>
									</TableCell>
									<TableCell>
										<Badge variant="outline">{res.resource_type}</Badge>
									</TableCell>
									<TableCell>
										<Badge variant="secondary">{res.access_level}</Badge>
									</TableCell>
									<TableCell>
										<Badge variant={res.is_active ? "default" : "secondary"}>
											{res.is_active ? "Active" : "Inactive"}
										</Badge>
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-2">
											<Button size="sm" variant="outline" onClick={() => {
												setEditing(res);
												setFormData({
													title: res.title,
													description: res.description || "",
													resource_type: res.resource_type,
													content_url: res.content_url,
													access_level: res.access_level,
													display_order: res.display_order,
													is_active: res.is_active,
													tags: res.tags || [],
												});
												setShowForm(true);
											}}>
												<Edit className="w-3 h-3" />
											</Button>
											<Button size="sm" variant="destructive" onClick={() => deleteResource(res.id)}>
												<Trash2 className="w-3 h-3" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>

			<Dialog open={showForm} onOpenChange={setShowForm}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{editing ? "Edit Resource" : "New Resource"}</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div>
							<label className="text-sm font-medium">Title *</label>
							<Input
								value={formData.title}
								onChange={(e) => setFormData({ ...formData, title: e.target.value })}
								placeholder="Resource title"
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
								<label className="text-sm font-medium">Resource Type</label>
								<Select value={formData.resource_type} onValueChange={(v) => setFormData({ ...formData, resource_type: v })}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="link">Link</SelectItem>
										<SelectItem value="document">Document</SelectItem>
										<SelectItem value="video">Video</SelectItem>
										<SelectItem value="tutorial">Tutorial</SelectItem>
										<SelectItem value="tool">Tool</SelectItem>
										<SelectItem value="other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<label className="text-sm font-medium">Access Level</label>
								<Select value={formData.access_level} onValueChange={(v) => setFormData({ ...formData, access_level: v })}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Members</SelectItem>
										<SelectItem value="premium">Premium Only</SelectItem>
										<SelectItem value="verified">Verified Only</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<div>
							<label className="text-sm font-medium">Content URL *</label>
							<Input
								value={formData.content_url}
								onChange={(e) => setFormData({ ...formData, content_url: e.target.value })}
								placeholder="https://..."
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="text-sm font-medium">Display Order</label>
								<Input
									type="number"
									value={formData.display_order}
									onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
								/>
							</div>
							<div className="flex items-center gap-2 pt-6">
								<input
									type="checkbox"
									checked={formData.is_active}
									onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
									className="rounded"
								/>
								<label className="text-sm font-medium">Active</label>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => {
							setShowForm(false);
							setEditing(null);
						}}>Cancel</Button>
						<Button onClick={() => void saveResource()}>Save</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

