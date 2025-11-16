import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Heart, Sparkles, Award, Users, Shield, CheckCircle2, Star } from "lucide-react";

interface MemberEditFormProps {
	member: any;
	onSave: (updates: any) => Promise<void>;
	onCancel: () => void;
}

export default function MemberEditForm({ member, onSave, onCancel }: MemberEditFormProps) {
	const [category, setCategory] = useState(member.member_category || "regular");
	const [priority, setPriority] = useState(member.priority_level || 0);
	const [isHidden, setIsHidden] = useState(member.is_hidden || false);
	const [emailHidden, setEmailHidden] = useState(member.email_hidden || false);
	const [notes, setNotes] = useState(member.special_notes || "");
	const [saving, setSaving] = useState(false);

	const handleSave = async () => {
		setSaving(true);
		try {
			await onSave({
				member_category: category,
				priority_level: priority,
				is_hidden: isHidden,
				email_hidden: emailHidden,
				special_notes: notes.trim() || null
			});
		} finally {
			setSaving(false);
		}
	};

	const categoryInfo = {
		admin: { icon: Shield, color: "text-red-500", desc: "Administrators with full access" },
		core_team: { icon: Crown, color: "text-purple-500", desc: "Core team members" },
		friend: { icon: Heart, color: "text-pink-500", desc: "Special friends and close connections" },
		special: { icon: Sparkles, color: "text-amber-500", desc: "Special members with unique status" },
		vip: { icon: Award, color: "text-yellow-500", desc: "VIP members with high priority" },
		regular: { icon: Users, color: "text-gray-500", desc: "Regular members" }
	};

	const CategoryIcon = categoryInfo[category as keyof typeof categoryInfo]?.icon || Users;

	return (
		<div className="space-y-6 py-4">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<CategoryIcon className={`w-5 h-5 ${categoryInfo[category as keyof typeof categoryInfo]?.color}`} />
						{member.full_name}
					</CardTitle>
					<CardDescription>{member.email}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Member Category */}
					<div className="space-y-2">
						<Label>Member Category</Label>
						<Select value={category} onValueChange={setCategory}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="regular">
									<div className="flex items-center gap-2">
										<Users className="w-4 h-4" />
										<span>Regular</span>
									</div>
								</SelectItem>
								<SelectItem value="friend">
									<div className="flex items-center gap-2">
										<Heart className="w-4 h-4 text-pink-500" />
										<span>Friend</span>
									</div>
								</SelectItem>
								<SelectItem value="special">
									<div className="flex items-center gap-2">
										<Sparkles className="w-4 h-4 text-amber-500" />
										<span>Special</span>
									</div>
								</SelectItem>
								<SelectItem value="vip">
									<div className="flex items-center gap-2">
										<Award className="w-4 h-4 text-yellow-500" />
										<span>VIP</span>
									</div>
								</SelectItem>
								<SelectItem value="core_team">
									<div className="flex items-center gap-2">
										<Crown className="w-4 h-4 text-purple-500" />
										<span>Core Team</span>
									</div>
								</SelectItem>
								<SelectItem value="admin">
									<div className="flex items-center gap-2">
										<Shield className="w-4 h-4 text-red-500" />
										<span>Admin</span>
									</div>
								</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							{categoryInfo[category as keyof typeof categoryInfo]?.desc}
						</p>
					</div>

					{/* Priority Level */}
					<div className="space-y-2">
						<Label>Priority Level (0-100)</Label>
						<div className="flex gap-2">
							<Input
								type="number"
								min="0"
								max="100"
								value={priority}
								onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
								className="flex-1"
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setPriority(Math.max(0, priority - 10))}
								disabled={priority <= 0}
							>
								-10
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setPriority(Math.min(100, priority + 10))}
								disabled={priority >= 100}
							>
								+10
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							Higher priority = appears first in lists. Use for special members (e.g., university crush 😉)
						</p>
						<div className="mt-2 p-2 bg-muted rounded text-xs">
							<p><strong>How it works:</strong></p>
							<ul className="list-disc list-inside space-y-1 mt-1">
								<li>0 = Normal priority (default)</li>
								<li>1-50 = Medium priority</li>
								<li>51-90 = High priority</li>
								<li>91-100 = Maximum priority (appears at top)</li>
								<li>Sorting: Priority → Verified Badge → Star Badge → Join Date</li>
							</ul>
						</div>
					</div>

					{/* Visibility */}
					<div className="space-y-4">
						<div className="space-y-2">
							<Label>Member Visibility</Label>
							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id="isHidden"
									checked={isHidden}
									onChange={(e) => setIsHidden(e.target.checked)}
									className="w-4 h-4"
								/>
								<label htmlFor="isHidden" className="text-sm">
									Hide member from public lists
								</label>
							</div>
							<p className="text-xs text-muted-foreground">
								Hidden members won't appear in public leaderboards or team browsing
							</p>
						</div>
						
						<div className="space-y-2">
							<Label>Email Visibility</Label>
							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id="emailHidden"
									checked={emailHidden}
									onChange={(e) => setEmailHidden(e.target.checked)}
									className="w-4 h-4"
								/>
								<label htmlFor="emailHidden" className="text-sm">
									Hide email from public view
								</label>
							</div>
							<p className="text-xs text-muted-foreground">
								Email will be hidden in team lists, leaderboards, and public member displays
							</p>
						</div>
					</div>

					{/* Special Notes */}
					<div className="space-y-2">
						<Label>Private Admin Notes</Label>
						<Textarea
							placeholder="Add private notes about this member (only visible to admins)..."
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={4}
						/>
						<p className="text-xs text-muted-foreground">
							These notes are only visible to admins in the admin panel. The member cannot see these notes.
						</p>
					</div>
					
					{/* Badge Information */}
					<Card className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-amber-500/20">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm">Current Badge System</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-xs">
							<div className="flex items-center gap-2">
								<CheckCircle2 className="w-4 h-4 text-blue-500" />
								<span><strong>Verified Badge</strong> - Top Priority Premium (Blue Checkmark)</span>
							</div>
							<div className="flex items-center gap-2">
								<Star className="w-4 h-4 text-amber-500 fill-amber-500" />
								<span><strong>Star Badge</strong> - Second Priority Premium (Gold Star)</span>
							</div>
							<p className="mt-2 text-muted-foreground">
								<strong>Total Badges Available:</strong> 2 (Both are premium/elite styled)
							</p>
							<p className="text-muted-foreground">
								Use "Manage Badges" button to grant/remove badges. Custom badges coming soon with GPT Pro support.
							</p>
						</CardContent>
					</Card>
				</CardContent>
			</Card>

			<div className="flex justify-end gap-2">
				<Button variant="outline" onClick={onCancel} disabled={saving}>
					Cancel
				</Button>
				<Button onClick={handleSave} disabled={saving}>
					{saving ? "Saving..." : "Save Changes"}
				</Button>
			</div>
		</div>
	);
}
