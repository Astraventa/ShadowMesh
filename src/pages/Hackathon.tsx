import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Calendar, 
  MapPin, 
  Trophy, 
  Users, 
  BookOpen, 
  Upload, 
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  FileText,
  Video,
  Link as LinkIcon,
  UserPlus,
  Search,
  X,
  Send,
  User
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import HackathonRegistration from "@/components/HackathonRegistration";

interface Hackathon {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_date: string;
  end_date?: string;
  location?: string;
  registration_deadline?: string;
  submission_deadline?: string;
  schedule_markdown?: string;
  rules_markdown?: string;
  details_markdown?: string;
  results_published_at?: string;
  status: string;
  category?: string;
  tags?: string[];
  payment_required?: boolean;
  fee_amount?: number;
  fee_currency?: string;
  max_participants?: number;
  submission_page_enabled?: boolean;
}

interface Registration {
  id: string;
  status: string;
  hackathon_id: string;
}

interface Team {
  id: string;
  team_name: string;
  hackathon_id: string;
  team_leader_id: string;
  status: string;
  max_members: number;
  members: Array<{ member_id: string; full_name: string; email: string; role: string }>;
}

interface Submission {
  id: string;
  title: string;
  description?: string;
  artifact_url?: string;
  video_url?: string;
  status: string;
  created_at: string;
}

interface Resource {
  id: string;
  title: string;
  description?: string;
  content_url?: string;
  resource_type: string;
}

interface SinglePlayer {
  id: string;
  full_name: string;
  email: string;
  area_of_interest?: string;
}

export default function Hackathon() {
  const { hackathonId } = useParams<{ hackathonId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [singlePlayers, setSinglePlayers] = useState<SinglePlayer[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showRegistration, setShowRegistration] = useState(false);
  
  // Team management states
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [showFindTeammates, setShowFindTeammates] = useState(false);
  const [showJoinTeam, setShowJoinTeam] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadHackathonData() {
      if (!hackathonId) {
        toast({ title: "Invalid hackathon", description: "Hackathon ID is missing.", variant: "destructive" });
        navigate("/member-portal");
        return;
      }

      try {
        setLoading(true);

        const authenticated = localStorage.getItem("shadowmesh_authenticated");
        const memberEmail = localStorage.getItem("shadowmesh_member_email");
        
        if (!authenticated || !memberEmail) {
          toast({ title: "Authentication required", description: "Please log in to view hackathon details." });
          navigate("/member-portal");
          return;
        }

        const { data: memberData } = await supabase
          .from("members")
          .select("id")
          .eq("email", memberEmail)
          .single();

        if (!memberData) {
          toast({ title: "Member not found", description: "Please ensure you're logged in." });
          navigate("/member-portal");
          return;
        }

        setMemberId(memberData.id);

        const { data: hackathonData, error: hackathonError } = await supabase
          .from("events")
          .select("*")
          .eq("id", hackathonId)
          .eq("event_type", "hackathon")
          .single();

        if (hackathonError || !hackathonData) {
          throw new Error("Hackathon not found");
        }

        setHackathon(hackathonData as Hackathon);

        const { data: regData } = await supabase
          .from("hackathon_registrations")
          .select("*")
          .eq("hackathon_id", hackathonId)
          .eq("member_id", memberData.id)
          .single();

        if (regData) {
          setRegistration(regData as Registration);
        }

        if (regData?.status === "approved") {
          // Load team
          const { data: teamData } = await supabase
            .from("hackathon_teams")
            .select(`
              *,
              team_members(
                member_id,
                role,
                members(id, full_name, email)
              )
            `)
            .eq("hackathon_id", hackathonId)
            .or(`team_leader_id.eq.${memberData.id},team_members.member_id.eq.${memberData.id}`)
            .single();

          if (teamData) {
            const formattedTeam = {
              ...teamData,
              members: (teamData.team_members || []).map((tm: any) => ({
                member_id: tm.member_id,
                full_name: tm.members?.full_name || "",
                email: tm.members?.email || "",
                role: tm.role
              }))
            };
            setTeam(formattedTeam as Team);
          }

          // Load all teams and single players
          await loadTeamsAndPlayers(hackathonId, memberData.id);

          // Load submission
          const { data: subData } = await supabase
            .from("hackathon_submissions")
            .select("*")
            .eq("hackathon_id", hackathonId)
            .or(`member_id.eq.${memberData.id}${teamData ? `,team_id.eq.${teamData.id}` : ""}`)
            .single();

          if (subData) {
            setSubmission(subData as Submission);
          }

          // Load resources
          const { data: resData } = await supabase
            .from("hackathon_resources")
            .select(`
              *,
              member_resources(*)
            `)
            .eq("hackathon_id", hackathonId)
            .order("display_order");

          if (resData) {
            const formattedResources = resData.map((r: any) => ({
              id: r.member_resources?.id || r.resource_id,
              title: r.member_resources?.title || "Resource",
              description: r.member_resources?.description,
              content_url: r.member_resources?.content_url,
              resource_type: r.member_resources?.resource_type || "link"
            }));
            setResources(formattedResources);
          }
        }

      } catch (error: any) {
        console.error("Error loading hackathon:", error);
        toast({ title: "Failed to load hackathon", description: error.message, variant: "destructive" });
        navigate("/member-portal");
      } finally {
        setLoading(false);
      }
    }

    loadHackathonData();
  }, [hackathonId, navigate, toast]);

  async function loadTeamsAndPlayers(hackathonId: string, currentMemberId: string) {
    try {
      // Get all approved registrations
      const { data: approvedRegs } = await supabase
        .from("hackathon_registrations")
        .select("member_id, members(id, full_name, email, area_of_interest)")
        .eq("hackathon_id", hackathonId)
        .eq("status", "approved");

      // Get all teams
      const { data: teamsData } = await supabase
        .from("hackathon_teams")
        .select(`
          *,
          team_members(
            member_id,
            role,
            members(id, full_name, email)
          )
        `)
        .eq("hackathon_id", hackathonId)
        .eq("status", "forming");

      if (teamsData) {
        const formattedTeams = teamsData.map((t: any) => ({
          ...t,
          members: (t.team_members || []).map((tm: any) => ({
            member_id: tm.member_id,
            full_name: tm.members?.full_name || "",
            email: tm.members?.email || "",
            role: tm.role
          }))
        }));
        setAllTeams(formattedTeams as Team[]);

        // Get team member IDs
        const teamMemberIds = new Set<string>();
        teamsData.forEach((t: any) => {
          if (t.team_leader_id) teamMemberIds.add(t.team_leader_id);
          (t.team_members || []).forEach((tm: any) => {
            if (tm.member_id) teamMemberIds.add(tm.member_id);
          });
        });

        // Get single players
        const singlePlayers = (approvedRegs || [])
          .filter((r: any) => !teamMemberIds.has(r.member_id) && r.member_id !== currentMemberId)
          .map((r: any) => ({
            id: r.member_id,
            full_name: r.members?.full_name || "",
            email: r.members?.email || "",
            area_of_interest: r.members?.area_of_interest || ""
          }));
        setSinglePlayers(singlePlayers);
      }
    } catch (error: any) {
      console.error("Error loading teams:", error);
    }
  }

  async function createTeam() {
    if (!memberId || !hackathonId || !teamName.trim()) {
      toast({ title: "Team name required", description: "Please enter a team name." });
      return;
    }

    try {
      const { data: teamData, error } = await supabase
        .from("hackathon_teams")
        .insert({
          hackathon_id: hackathonId,
          team_name: teamName.trim(),
          team_leader_id: memberId,
          status: "forming",
          max_members: 4
        })
        .select()
        .single();

      if (error) throw error;

      // Add leader to team_members
      await supabase
        .from("team_members")
        .insert({
          team_id: teamData.id,
          member_id: memberId,
          role: "leader"
        });

      toast({ title: "Team created!", description: "You can now invite teammates." });
      setShowCreateTeam(false);
      setTeamName("");
      window.location.reload();
    } catch (e: any) {
      toast({ title: "Failed to create team", description: e.message });
    }
  }

  async function joinTeam(teamId: string) {
    if (!memberId) return;

    try {
      // Check if team has space
      const { data: teamData } = await supabase
        .from("hackathon_teams")
        .select("id, max_members, team_members(count)")
        .eq("id", teamId)
        .single();

      const { data: members } = await supabase
        .from("team_members")
        .select("member_id")
        .eq("team_id", teamId);

      if (members && members.length >= (teamData?.max_members || 4)) {
        toast({ title: "Team full", description: "This team has reached maximum capacity." });
        return;
      }

      await supabase
        .from("team_members")
        .insert({
          team_id: teamId,
          member_id: memberId,
          role: "member"
        });

      toast({ title: "Joined team!", description: "You've successfully joined the team." });
      setShowJoinTeam(null);
      window.location.reload();
    } catch (e: any) {
      toast({ title: "Failed to join team", description: e.message });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading hackathon...</p>
        </div>
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Hackathon Not Found</h2>
            <p className="text-muted-foreground mb-4">The hackathon you're looking for doesn't exist.</p>
            <Button asChild>
              <Link to="/member-portal">Back to Portal</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isApproved = registration?.status === "approved";
  const isPending = registration?.status === "pending";
  const isRejected = registration?.status === "rejected";
  const hasTeam = !!team;
  const hasSubmission = !!submission;
  const now = new Date();
  const startDate = new Date(hackathon.start_date);
  const endDate = hackathon.end_date ? new Date(hackathon.end_date) : null;
  const submissionDeadline = hackathon.submission_deadline ? new Date(hackathon.submission_deadline) : null;
  const registrationDeadline = hackathon.registration_deadline ? new Date(hackathon.registration_deadline) : null;
  
  const isStarted = now >= startDate;
  const isEnded = endDate ? now >= endDate : false;
  const canSubmit = isStarted && !isEnded && (submissionDeadline ? now <= submissionDeadline : true) && hackathon.submission_page_enabled;
  const registrationClosed = registrationDeadline ? now > registrationDeadline : false;
  const resultsPublished = hackathon.results_published_at ? new Date(hackathon.results_published_at) <= now : false;

  const filteredTeams = allTeams.filter(t => 
    t.team_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.members.some(m => m.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredPlayers = singlePlayers.filter(p =>
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.area_of_interest && p.area_of_interest.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header - Compact */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" asChild size="sm">
              <Link to="/member-portal" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Portal
              </Link>
            </Button>
            <Badge variant={hackathon.status === "ongoing" ? "default" : "secondary"} className="text-xs px-3 py-0.5">
              {hackathon.status.toUpperCase()}
            </Badge>
          </div>
        </div>
      </div>

      {/* Hero Section - More Compact and Professional */}
      <div className="bg-gradient-to-br from-purple-950/95 via-red-900/85 to-amber-950/95 border-b border-purple-800/30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <Trophy className="w-6 h-6 text-amber-950" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-white leading-tight truncate">{hackathon.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge className="bg-purple-600 text-white text-xs px-2 py-0.5">HACKATHON</Badge>
                {hackathon.category && (
                  <Badge variant="outline" className="border-purple-400 text-purple-200 text-xs px-2 py-0.5">
                    {hackathon.category.toUpperCase()}
                  </Badge>
                )}
                {hackathon.tags && hackathon.tags.length > 0 && (
                  <>
                    {hackathon.tags.slice(0, 3).map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-purple-800/50 text-purple-200 text-xs px-2 py-0.5">
                        {tag}
                      </Badge>
                    ))}
                  </>
                )}
              </div>
              {hackathon.description && (
                <p className="text-purple-100/90 text-sm leading-relaxed max-w-3xl mb-4 line-clamp-2">
                  {hackathon.description}
                </p>
              )}
            </div>
          </div>

          {/* Stats Row - Compact */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <Card className="bg-purple-900/40 border-purple-700/60 backdrop-blur-md shadow-lg">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-purple-200">
                  <Calendar className="w-4 h-4 text-purple-300 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-purple-300/80 mb-0.5">Start Date</p>
                    <p className="font-semibold text-sm truncate">{formatDate(hackathon.start_date)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {hackathon.end_date && (
              <Card className="bg-purple-900/40 border-purple-700/60 backdrop-blur-md shadow-lg">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-purple-200">
                    <Clock className="w-4 h-4 text-purple-300 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-purple-300/80 mb-0.5">End Date</p>
                      <p className="font-semibold text-sm truncate">{formatDate(hackathon.end_date)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {hackathon.location && (
              <Card className="bg-purple-900/40 border-purple-700/60 backdrop-blur-md shadow-lg">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-purple-200">
                    <MapPin className="w-4 h-4 text-purple-300 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-purple-300/80 mb-0.5">Location</p>
                      <p className="font-semibold text-sm truncate">{hackathon.location}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {hackathon.max_participants && (
              <Card className="bg-purple-900/40 border-purple-700/60 backdrop-blur-md shadow-lg">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-purple-200">
                    <Users className="w-4 h-4 text-purple-300 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-purple-300/80 mb-0.5">Max Participants</p>
                      <p className="font-semibold text-sm">{hackathon.max_participants}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Registration Status */}
          {!isApproved && !isPending && !isRejected && !registrationClosed && (
            <div className="mt-4">
              <Button 
                size="sm" 
                className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-600/90 hover:to-purple-800/90"
                onClick={() => setShowRegistration(true)}
              >
                Register for Hackathon
              </Button>
            </div>
          )}
          {isPending && (
            <div className="mt-4">
              <Badge variant="outline" className="bg-yellow-900/30 border-yellow-600 text-yellow-200 text-xs px-2 py-1">
                Registration Pending Approval
              </Badge>
            </div>
          )}
          {isRejected && (
            <div className="mt-4">
              <Badge variant="destructive" className="text-xs px-2 py-1">Registration Rejected</Badge>
            </div>
          )}
          {registrationClosed && !registration && (
            <div className="mt-4">
              <Badge variant="secondary" className="bg-gray-800 text-gray-300 text-xs px-2 py-1">
                Registration Closed
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Compact and Professional */}
      {isApproved ? (
        <div className="container mx-auto px-4 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5 bg-muted/50 backdrop-blur-sm h-9 p-0.5">
              <TabsTrigger value="overview" className="text-sm">Overview</TabsTrigger>
              <TabsTrigger value="teams" className="text-sm">Teams</TabsTrigger>
              <TabsTrigger value="resources" className="text-sm">Resources</TabsTrigger>
              <TabsTrigger value="submissions" className="text-sm">Submissions</TabsTrigger>
              {resultsPublished && <TabsTrigger value="results" className="text-sm">Results</TabsTrigger>}
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              {hackathon.details_markdown && (
                <Card className="shadow-lg border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: hackathon.details_markdown }} />
                  </CardContent>
                </Card>
              )}

              {hackathon.schedule_markdown && (
                <Card className="shadow-lg border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Schedule</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: hackathon.schedule_markdown }} />
                  </CardContent>
                </Card>
              )}

              {hackathon.rules_markdown && (
                <Card className="shadow-lg border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Rules & Guidelines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: hackathon.rules_markdown }} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Teams Tab - Premium Team Management */}
            <TabsContent value="teams" className="space-y-8">
              {hasTeam ? (
                <Card className="shadow-xl border-2">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl flex items-center gap-3">
                      <Users className="w-6 h-6" />
                      Your Team: {team.team_name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4">
                      {team.members.map((member) => (
                        <div key={member.member_id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                          <div>
                            <p className="font-semibold text-lg">{member.full_name}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                          <Badge variant={member.role === "leader" ? "default" : "secondary"}>
                            {member.role === "leader" ? "Leader" : "Member"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    {team.members.length < team.max_members && (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => {
                          setShowFindTeammates(true);
                          if (hackathonId) loadTeamsAndPlayers(hackathonId, memberId!);
                        }}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Invite Teammates
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="shadow-xl border-2">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-2xl flex items-center gap-3">
                        <Users className="w-6 h-6" />
                        Create Team
                      </CardTitle>
                      <CardDescription>Start your own team and invite members</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        className="w-full" 
                        size="lg"
                        onClick={() => setShowCreateTeam(true)}
                      >
                        Create New Team
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="shadow-xl border-2">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-2xl flex items-center gap-3">
                        <UserPlus className="w-6 h-6" />
                        Join Team
                      </CardTitle>
                      <CardDescription>Browse and join existing teams</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        variant="outline" 
                        className="w-full" 
                        size="lg"
                        onClick={() => {
                          setShowJoinTeam("browse");
                          if (hackathonId) loadTeamsAndPlayers(hackathonId, memberId!);
                        }}
                      >
                        Browse Teams
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* All Teams Section */}
              {showJoinTeam === "browse" && (
                <Card className="shadow-xl border-2">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-2xl">Available Teams</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setShowJoinTeam(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="relative mt-4">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Search teams..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {filteredTeams.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No teams found</p>
                    ) : (
                      filteredTeams.map((t) => (
                        <div key={t.id} className="p-4 bg-muted/50 rounded-lg border">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-lg">{t.team_name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {t.members.length} / {t.max_members} members
                              </p>
                            </div>
                            {t.members.length < t.max_members && (
                              <Button size="sm" onClick={() => joinTeam(t.id)}>
                                Join
                              </Button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {t.members.map((m) => (
                              <Badge key={m.member_id} variant="secondary">
                                {m.full_name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Single Players Section */}
              <Card className="shadow-xl border-2">
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl flex items-center gap-3">
                    <User className="w-6 h-6" />
                    Single Players
                  </CardTitle>
                  <CardDescription>Players looking for teams</CardDescription>
                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search players..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {filteredPlayers.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8 col-span-2">No single players found</p>
                    ) : (
                      filteredPlayers.map((player) => (
                        <div key={player.id} className="p-4 bg-muted/50 rounded-lg border">
                          <p className="font-semibold">{player.full_name}</p>
                          <p className="text-sm text-muted-foreground">{player.email}</p>
                          {player.area_of_interest && (
                            <Badge variant="outline" className="mt-2">
                              {player.area_of_interest}
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Resources Tab */}
            <TabsContent value="resources" className="space-y-6">
              <Card className="shadow-xl border-2">
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl flex items-center gap-3">
                    <BookOpen className="w-6 h-6" />
                    Hackathon Resources
                  </CardTitle>
                  <CardDescription>Resources and materials for this hackathon</CardDescription>
                </CardHeader>
                <CardContent>
                  {resources.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">No resources available yet</p>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                      {resources.map((resource) => (
                        <Card key={resource.id} className="border">
                          <CardHeader>
                            <CardTitle className="text-lg">{resource.title}</CardTitle>
                            {resource.description && (
                              <CardDescription>{resource.description}</CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            {resource.content_url && (
                              <Button variant="outline" asChild className="w-full">
                                <a href={resource.content_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Open Resource
                                </a>
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Submissions Tab */}
            <TabsContent value="submissions" className="space-y-6">
              <Card className="shadow-xl border-2">
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl flex items-center gap-3">
                    <Upload className="w-6 h-6" />
                    Submission
                  </CardTitle>
                  <CardDescription>
                    {hasSubmission ? "View or update your submission" : "Submit your hackathon project"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!hackathon.submission_page_enabled ? (
                    <div className="text-center py-12">
                      <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Submission Page Not Available</h3>
                      <p className="text-muted-foreground">The submission page will be available soon.</p>
                    </div>
                  ) : hasSubmission ? (
                    <div className="space-y-6">
                      <div className="p-6 bg-muted/50 rounded-lg border">
                        <h3 className="font-semibold text-xl mb-3">{submission.title}</h3>
                        {submission.description && (
                          <p className="text-muted-foreground mb-4">{submission.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3">
                          {submission.artifact_url && (
                            <Button variant="outline" asChild>
                              <a href={submission.artifact_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Project
                              </a>
                            </Button>
                          )}
                          {submission.video_url && (
                            <Button variant="outline" asChild>
                              <a href={submission.video_url} target="_blank" rel="noopener noreferrer">
                                <Video className="w-4 h-4 mr-2" />
                                Watch Demo
                              </a>
                            </Button>
                          )}
                        </div>
                        <Badge className="mt-4" variant={submission.status === "submitted" ? "default" : "secondary"}>
                          {submission.status.replace("_", " ").toUpperCase()}
                        </Badge>
                      </div>
                      {canSubmit && (
                        <Button variant="outline" onClick={() => toast({ title: "Update submission", description: "Feature coming soon!" })}>
                          Update Submission
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      {canSubmit ? (
                        <>
                          <Upload className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground mb-6 text-lg">Submit your hackathon project</p>
                          <Button size="lg" onClick={() => toast({ title: "Submit project", description: "Submission form coming soon!" })}>
                            Submit Project
                          </Button>
                        </>
                      ) : (
                        <>
                          <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground text-lg">
                            {!isStarted ? "Submissions will open when the hackathon starts." : "Submission deadline has passed."}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Results Tab */}
            {resultsPublished && (
              <TabsContent value="results" className="space-y-6">
                <Card className="shadow-xl border-2">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl">Results</CardTitle>
                    <CardDescription>Hackathon winners and rankings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-center py-12">Results will be displayed here once published.</p>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      ) : (
        <div className="container mx-auto px-6 py-12">
          <Card className="shadow-xl border-2 max-w-2xl mx-auto">
            <CardContent className="pt-12 pb-12 text-center">
              <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
              <h2 className="text-2xl font-bold mb-3">Registration Required</h2>
              <p className="text-muted-foreground mb-6 text-lg">
                {isPending 
                  ? "Your registration is pending approval. You'll be notified once approved."
                  : isRejected
                  ? "Your registration was rejected. Please contact support if you believe this is an error."
                  : "Please register for this hackathon to access the dashboard."
                }
              </p>
              {!registration && !registrationClosed && (
                <Button size="lg" onClick={() => setShowRegistration(true)}>
                  Register Now
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Team Dialog */}
      <Dialog open={showCreateTeam} onOpenChange={setShowCreateTeam}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>Create a new team for this hackathon</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Team Name</label>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Enter team name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTeam(false)}>Cancel</Button>
            <Button onClick={createTeam} disabled={!teamName.trim()}>Create Team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registration Dialog */}
      {showRegistration && hackathonId && memberId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Register for Hackathon</CardTitle>
            </CardHeader>
            <CardContent>
              <HackathonRegistration
                hackathonId={hackathonId}
                hackathonTitle={hackathon.title}
                memberId={memberId}
                paymentRequired={hackathon.payment_required || false}
                feeAmount={hackathon.fee_amount || 0}
                feeCurrency={hackathon.fee_currency || "PKR"}
                onSuccess={() => {
                  setShowRegistration(false);
                  window.location.reload();
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
