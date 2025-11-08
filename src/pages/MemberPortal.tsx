import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Calendar, BookOpen, ExternalLink, Download, Video, Link as LinkIcon, FileText, Users, Trophy, Activity, Send, KeyRound } from "lucide-react";
import HackathonRegistration from "@/components/HackathonRegistration";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Member {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  cohort?: string;
  secret_code?: string;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_date: string;
  end_date?: string;
  location?: string;
  registration_link?: string;
  max_participants?: number;
  is_member_only: boolean;
}

interface Resource {
  id: string;
  title: string;
  description?: string;
  resource_type: string;
  content_url?: string;
  access_level: string;
}

interface HackathonRegistration {
  id: string;
  hackathon_id: string;
  status: string;
  payment_method?: string;
  transaction_id?: string;
  payment_amount?: number;
  reviewed_at?: string;
  rejection_reason?: string;
}

interface Team {
  id: string;
  team_name: string;
  hackathon_id: string;
  team_leader_id: string;
  status: string;
  members: Array<{ member_id: string; full_name: string; email: string; role: string }>;
}

interface TeamRequest {
  id: string;
  team_id: string;
  from_member_id: string;
  status: string;
  message?: string;
  team_name?: string;
  from_member_name?: string;
}

interface Activity {
  id: string;
  activity_type: string;
  created_at: string;
  activity_data?: any;
}

export default function MemberPortal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<Set<string>>(new Set());
  const [hackathons, setHackathons] = useState<Event[]>([]);
  const [hackathonRegistrations, setHackathonRegistrations] = useState<HackathonRegistration[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamRequests, setTeamRequests] = useState<TeamRequest[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showHackathonReg, setShowHackathonReg] = useState<string | null>(null);
  const [showTeamForm, setShowTeamForm] = useState<string | null>(null);
  const [showFindTeammates, setShowFindTeammates] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [requestMessage, setRequestMessage] = useState("");

  useEffect(() => {
    // Check if user has verification token
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("code") || params.get("token");
    const token = tokenParam || localStorage.getItem("shadowmesh_member_token");
    
    if (!token) {
      toast({ title: "Access Denied", description: "Please use your verification token to access the member portal." });
      navigate("/#join");
      return;
    }

    loadMemberData(token.trim().toUpperCase());
  }, []);

  async function loadMemberData(token: string) {
    setLoading(true);
    try {
      // Verify token and get member info
      const payloadKey = token.includes("-") ? "verification_token" : "code";
      const verifyRes = await fetch(`${SUPABASE_URL}/functions/v1/verify`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ [payloadKey]: token }),
      });

      if (!verifyRes.ok) {
        throw new Error("Invalid token");
      }

      const verifyData = await verifyRes.json();
      if (verifyData.status !== "approved") {
        throw new Error("Your application is not approved yet");
      }

      // Get member details - try by email first, then by secret_code
      let memberData = null;
      let memberError = null;
      
      if (verifyData.email) {
        const { data, error } = await supabase
          .from("members")
          .select("*")
          .eq("email", verifyData.email)
          .single();
        memberData = data;
        memberError = error;
      }
      
      // If not found by email, try by secret_code
      if (!memberData && verifyData.secret_code) {
        const { data, error } = await supabase
          .from("members")
          .select("*")
          .eq("secret_code", verifyData.secret_code.toUpperCase())
          .single();
        memberData = data;
        memberError = error;
      }

      if (memberError || !memberData) {
        throw new Error("Member not found. Please ensure your application has been approved and you're using the correct code.");
      }

      setMember(memberData);
      const storedCode = (verifyData.secret_code || token).toUpperCase();
      localStorage.setItem("shadowmesh_member_token", storedCode);

      // Load events (workshops and other events, excluding hackathons)
      const { data: eventsData } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .neq("event_type", "hackathon")
        .gte("start_date", new Date().toISOString())
        .order("start_date", { ascending: true });

      if (eventsData) setEvents(eventsData);

      // Load resources
      const { data: resourcesData } = await supabase
        .from("member_resources")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (resourcesData) setResources(resourcesData);

      // Load registered events
      const { data: registrations } = await supabase
        .from("event_registrations")
        .select("event_id")
        .eq("member_id", memberData.id)
        .eq("status", "registered");

      if (registrations) {
        setRegisteredEvents(new Set(registrations.map((r: any) => r.event_id)));
      }

      // Load hackathons (events with event_type = 'hackathon')
      const { data: hackathonsData } = await supabase
        .from("events")
        .select("*")
        .eq("event_type", "hackathon")
        .eq("is_active", true)
        .gte("start_date", new Date().toISOString())
        .order("start_date", { ascending: true });

      if (hackathonsData) setHackathons(hackathonsData);

      // Load hackathon registrations
      const { data: hackRegData } = await supabase
        .from("hackathon_registrations")
        .select("*")
        .eq("member_id", memberData.id);

      if (hackRegData) setHackathonRegistrations(hackRegData);

      // Load teams (where user is a member or leader) - simplified query
      try {
        // First, get teams where user is leader
        const { data: leaderTeams } = await supabase
          .from("hackathon_teams")
          .select("*")
          .eq("team_leader_id", memberData.id);

        // Then, get teams where user is a member
        const { data: memberTeamsData } = await supabase
          .from("team_members")
          .select("team_id, hackathon_teams(*)")
          .eq("member_id", memberData.id);

        // Combine and deduplicate
        const allTeamIds = new Set<string>();
        const allTeams: any[] = [];

        if (leaderTeams) {
          leaderTeams.forEach((t: any) => {
            if (!allTeamIds.has(t.id)) {
              allTeamIds.add(t.id);
              allTeams.push(t);
            }
          });
        }

        if (memberTeamsData) {
          memberTeamsData.forEach((tm: any) => {
            const team = tm.hackathon_teams;
            if (team && !allTeamIds.has(team.id)) {
              allTeamIds.add(team.id);
              allTeams.push(team);
            }
          });
        }

        // Now load members for each team
        const formattedTeams = await Promise.all(
          allTeams.map(async (team: any) => {
            const { data: teamMembersData } = await supabase
              .from("team_members")
              .select("member_id, role, members(full_name, email)")
              .eq("team_id", team.id);

            return {
              ...team,
              members: (teamMembersData || []).map((tm: any) => ({
                member_id: tm.member_id,
                full_name: tm.members?.full_name || "",
                email: tm.members?.email || "",
                role: tm.role,
              })),
            };
          })
        );

        setTeams(formattedTeams);
      } catch (teamsError) {
        console.warn("Failed to load teams:", teamsError);
        // Continue without teams - not critical
      }

      // Load team requests (pending requests to user)
      const { data: requestsData } = await supabase
        .from("team_requests")
        .select(`
          *,
          hackathon_teams(team_name),
          members!team_requests_from_member_id_fkey(full_name)
        `)
        .eq("to_member_id", memberData.id)
        .eq("status", "pending");

      if (requestsData) {
        const formatted = requestsData.map((r: any) => ({
          ...r,
          team_name: r.hackathon_teams?.team_name,
          from_member_name: r.members?.full_name,
        }));
        setTeamRequests(formatted);
      }

      // Load activity history
      const { data: activityData } = await supabase
        .from("member_activity")
        .select("*")
        .eq("member_id", memberData.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (activityData) setActivities(activityData);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to load member data" });
      navigate("/#join");
    } finally {
      setLoading(false);
    }
  }

  async function registerForEvent(eventId: string) {
    if (!member) return;

    try {
      const { error } = await supabase
        .from("event_registrations")
        .insert({
          event_id: eventId,
          member_id: member.id,
          status: "registered",
        });

      if (error) throw error;

      setRegisteredEvents((prev) => new Set([...prev, eventId]));
      toast({ title: "Registered!", description: "You've successfully registered for this event." });
    } catch (e: any) {
      toast({ title: "Registration failed", description: e.message || "Please try again." });
    }
  }

  function getResourceIcon(type: string) {
    switch (type) {
      case "video": return <Video className="w-5 h-5" />;
      case "download": return <Download className="w-5 h-5" />;
      case "link": return <LinkIcon className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  }

  async function createTeam(hackathonId: string) {
    if (!member || !teamName.trim()) {
      toast({ title: "Team name required", description: "Please enter a team name." });
      return;
    }

    try {
      const { data: team, error } = await supabase
        .from("hackathon_teams")
        .insert({
          hackathon_id: hackathonId,
          team_name: teamName.trim(),
          team_leader_id: member.id,
          status: "forming",
        })
        .select()
        .single();

      if (error) throw error;

      // Add leader as team member
      await supabase.from("team_members").insert({
        team_id: team.id,
        member_id: member.id,
        role: "leader",
      });

      // Log activity
      await supabase.from("member_activity").insert({
        member_id: member.id,
        activity_type: "team_created",
        activity_data: { team_id: team.id, team_name: teamName, hackathon_id: hackathonId },
        related_id: team.id,
      });

      toast({ title: "Team created!", description: "You can now invite teammates." });
      setShowTeamForm(null);
      setTeamName("");
      void loadMemberData(localStorage.getItem("shadowmesh_member_token") || "");
    } catch (e: any) {
      toast({ title: "Failed to create team", description: e.message });
    }
  }

  async function sendTeamRequest(teamId: string, toMemberId: string) {
    if (!member) return;

    try {
      const { error } = await supabase.from("team_requests").insert({
        team_id: teamId,
        from_member_id: member.id,
        to_member_id: toMemberId,
        message: requestMessage.trim() || null,
        status: "pending",
      });

      if (error) throw error;

      toast({ title: "Request sent!", description: "The member will be notified." });
      setRequestMessage("");
      void loadMemberData(localStorage.getItem("shadowmesh_member_token") || "");
    } catch (e: any) {
      toast({ title: "Failed to send request", description: e.message });
    }
  }

  async function respondToRequest(requestId: string, accept: boolean) {
    if (!member) return;

    try {
      const { error } = await supabase
        .from("team_requests")
        .update({
          status: accept ? "accepted" : "rejected",
          responded_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      if (accept) {
        // Get team info
        const { data: request } = await supabase
          .from("team_requests")
          .select("team_id")
          .eq("id", requestId)
          .single();

        if (request) {
          // Add member to team
          await supabase.from("team_members").insert({
            team_id: request.team_id,
            member_id: member.id,
            role: "member",
          });

          // Log activity
          await supabase.from("member_activity").insert({
            member_id: member.id,
            activity_type: "team_joined",
            activity_data: { team_id: request.team_id },
            related_id: request.team_id,
          });
        }
      }

      toast({ title: accept ? "Request accepted!" : "Request rejected" });
      void loadMemberData(localStorage.getItem("shadowmesh_member_token") || "");
    } catch (e: any) {
      toast({ title: "Failed to respond", description: e.message });
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary mx-auto mb-6"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-primary animate-pulse" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Loading Member Portal
          </h3>
          <p className="text-muted-foreground">Accessing your ShadowMesh dashboard...</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent">
                Welcome back, {member.full_name.split(' ')[0]}!
              </h1>
              <p className="text-lg text-muted-foreground">ShadowMesh Member Portal • Your gateway to AI × Cyber</p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <Badge variant="secondary" className="px-4 py-2 text-sm">
                <KeyRound className="w-4 h-4 mr-2" />
                {member.secret_code}
              </Badge>
            </div>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Events</p>
                    <p className="text-2xl font-bold">{events.length}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-primary/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/30 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Hackathons</p>
                    <p className="text-2xl font-bold">{hackathons.length}</p>
                  </div>
                  <Trophy className="w-8 h-8 text-purple-500/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/30 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Teams</p>
                    <p className="text-2xl font-bold">{teams.length}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-500/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Resources</p>
                    <p className="text-2xl font-bold">{resources.length}</p>
                  </div>
                  <BookOpen className="w-8 h-8 text-green-500/50" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="events" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-muted/50 backdrop-blur-sm border border-border/50 p-1 rounded-lg">
            <TabsTrigger value="events" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Calendar className="w-4 h-4 mr-2" />
              Events
            </TabsTrigger>
            <TabsTrigger value="hackathons" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Trophy className="w-4 h-4 mr-2" />
              Hackathons
            </TabsTrigger>
            <TabsTrigger value="teams" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="w-4 h-4 mr-2" />
              Teams
            </TabsTrigger>
            <TabsTrigger value="resources" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BookOpen className="w-4 h-4 mr-2" />
              Resources
            </TabsTrigger>
            <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Activity className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
          </TabsList>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-6">
            {events.length === 0 ? (
              <Card className="bg-muted/30 backdrop-blur-sm border-border/50">
                <CardContent className="py-16 text-center">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-10 h-10 text-primary/50" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No upcoming events</h3>
                  <p className="text-muted-foreground">Check back soon for workshops, hackathons, and meetups!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {events.map((event) => (
                  <Card key={event.id} className="bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-2">{event.title}</CardTitle>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
                              {event.event_type}
                            </Badge>
                            <span className="text-sm text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground">{formatDate(event.start_date)}</span>
                          </div>
                        </div>
                        {registeredEvents.has(event.id) && (
                          <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                            ✓ Registered
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {event.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
                      )}
                      <div className="space-y-2 text-sm">
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">📍</span>
                            <span>{event.location}</span>
                          </div>
                        )}
                        {event.max_participants && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">👥</span>
                            <span>Max {event.max_participants} participants</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2">
                        {registeredEvents.has(event.id) ? (
                          <Button variant="secondary" className="flex-1" disabled>
                            Already Registered
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="default"
                              className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                              onClick={() => registerForEvent(event.id)}
                            >
                              Register Now
                            </Button>
                            {event.registration_link && (
                              <Button variant="outline" asChild>
                                <a href={event.registration_link} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {resources.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No resources available at the moment.</p>
                  </CardContent>
                </Card>
              ) : (
                resources.map((resource) => (
                  <Card key={resource.id}>
                    <CardHeader>
                      <div className="flex items-center gap-2 mb-2">
                        {getResourceIcon(resource.resource_type)}
                        <CardTitle className="text-lg">{resource.title}</CardTitle>
                      </div>
                      <CardDescription>
                        <Badge variant="outline">{resource.resource_type}</Badge>
                        {resource.access_level === "premium" && (
                          <Badge variant="secondary" className="ml-2">Premium</Badge>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {resource.description && (
                        <p className="text-sm text-muted-foreground mb-4">{resource.description}</p>
                      )}
                      {resource.content_url && (
                        <Button variant="outline" className="w-full" asChild>
                          <a href={resource.content_url} target="_blank" rel="noopener noreferrer">
                            {resource.resource_type === "download" ? (
                              <>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </>
                            ) : (
                              <>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Open
                              </>
                            )}
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Hackathons Tab */}
          <TabsContent value="hackathons">
            <div className="space-y-6">
              {teamRequests.length > 0 && (
                <Card className="border-primary/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Team Requests ({teamRequests.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {teamRequests.map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-3 bg-muted rounded">
                        <div>
                          <p className="font-medium">{req.from_member_name} invited you to join "{req.team_name}"</p>
                          {req.message && <p className="text-sm text-muted-foreground mt-1">{req.message}</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => respondToRequest(req.id, true)}>Accept</Button>
                          <Button size="sm" variant="outline" onClick={() => respondToRequest(req.id, false)}>Decline</Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {hackathons.length === 0 ? (
                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/30 backdrop-blur-sm">
                  <CardContent className="py-16 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <Trophy className="w-10 h-10 text-purple-500/50" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No upcoming hackathons</h3>
                    <p className="text-muted-foreground">Check back soon for exciting hackathon opportunities!</p>
                  </CardContent>
                </Card>
              ) : (
                hackathons.map((hackathon) => {
                  const reg = hackathonRegistrations.find((r) => r.hackathon_id === hackathon.id);
                  const userTeam = teams.find((t) => t.hackathon_id === hackathon.id);
                  const isApproved = reg?.status === "approved";

                  return (
                    <Card key={hackathon.id} className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/30 backdrop-blur-sm hover:border-purple-500/50 transition-all duration-300">
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <CardTitle className="text-xl mb-2 flex items-center gap-2">
                              <Trophy className="w-5 h-5 text-purple-400" />
                              {hackathon.title}
                            </CardTitle>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="bg-purple-500/20 border-purple-500/30 text-purple-300">
                                Hackathon
                              </Badge>
                              <span className="text-sm text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground">{formatDate(hackathon.start_date)}</span>
                            </div>
                          </div>
                          {isApproved && (
                            <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                              ✓ Approved
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {hackathon.description && <p className="text-sm text-muted-foreground">{hackathon.description}</p>}
                        
                        {!reg ? (
                          <div>
                            <p className="text-sm mb-3">This hackathon requires payment and registration.</p>
                            <Button onClick={() => setShowHackathonReg(hackathon.id)}>Register for Hackathon</Button>
                          </div>
                        ) : reg.status === "pending" ? (
                          <div className="space-y-2">
                            <Badge variant="outline">Registration Pending</Badge>
                            <p className="text-sm text-muted-foreground">Your registration is under review. You'll be notified once approved.</p>
                          </div>
                        ) : reg.status === "approved" ? (
                          <div className="space-y-3">
                            <Badge variant="secondary">✓ Approved for Hackathon</Badge>
                            {!userTeam ? (
                              <div className="space-y-2">
                                <p className="text-sm">Create or join a team to participate!</p>
                                <div className="flex gap-2">
                                  <Button onClick={() => setShowTeamForm(hackathon.id)}>Create Team</Button>
                                  <Button variant="outline" onClick={() => setShowFindTeammates(hackathon.id)}>Find Teammates</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 bg-muted rounded">
                                <p className="font-medium mb-2">Your Team: {userTeam.team_name}</p>
                                <div className="space-y-1">
                                  {userTeam.members.map((m) => (
                                    <p key={m.member_id} className="text-sm">
                                      {m.full_name} {m.role === "leader" && "(Leader)"}
                                    </p>
                                  ))}
                                </div>
                                {userTeam.members.length < 4 && (
                                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowFindTeammates(hackathon.id)}>
                                    Invite More Members
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <Badge variant="destructive">Registration Rejected</Badge>
                            {reg.rejection_reason && <p className="text-sm text-muted-foreground mt-2">{reg.rejection_reason}</p>}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams">
            <div className="space-y-6">
              {teams.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">You're not part of any teams yet.</p>
                    <p className="text-sm text-muted-foreground mt-2">Join a hackathon and create or join a team!</p>
                  </CardContent>
                </Card>
              ) : (
                teams.map((team) => (
                  <Card key={team.id}>
                    <CardHeader>
                      <CardTitle>{team.team_name}</CardTitle>
                      <CardDescription>
                        <Badge variant={team.status === "complete" ? "secondary" : "outline"}>{team.status}</Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="font-medium">Team Members ({team.members.length}/4):</p>
                        {team.members.map((m) => (
                          <div key={m.member_id} className="flex items-center justify-between p-2 bg-muted rounded">
                            <div>
                              <p className="font-medium">{m.full_name}</p>
                              <p className="text-xs text-muted-foreground">{m.email}</p>
                            </div>
                            <Badge variant={m.role === "leader" ? "default" : "outline"}>{m.role}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Member Profile</CardTitle>
                <CardDescription>Your ShadowMesh membership information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                  <p className="text-lg">{member.full_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-lg">{member.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">ShadowMesh Code</label>
                  <p className="font-mono text-sm">{member.secret_code}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Member Since</label>
                  <p className="text-lg">{formatDate(member.created_at)}</p>
                </div>
                {member.cohort && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Cohort</label>
                    <p className="text-lg">{member.cohort}</p>
                  </div>
                )}
                <div className="pt-4 border-t">
                  <Button variant="outline" onClick={() => {
                    localStorage.removeItem("shadowmesh_member_token");
                    navigate("/");
                  }}>
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Activity History */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Activity History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No activity yet.</p>
                ) : (
                  <div className="space-y-2">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between p-3 bg-muted rounded">
                        <div>
                          <p className="font-medium capitalize">{activity.activity_type.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(activity.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Hackathon Registration Dialog */}
        {showHackathonReg && member && (
          <Dialog open onOpenChange={() => setShowHackathonReg(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Register for Hackathon</DialogTitle>
              </DialogHeader>
              <HackathonRegistration
                hackathonId={showHackathonReg}
                hackathonTitle={hackathons.find((h) => h.id === showHackathonReg)?.title || "Hackathon"}
                memberId={member.id}
                onSuccess={() => {
                  setShowHackathonReg(null);
                  void loadMemberData(localStorage.getItem("shadowmesh_member_token") || "");
                }}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* Create Team Dialog */}
        {showTeamForm && member && (
          <Dialog open onOpenChange={() => setShowTeamForm(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Team</DialogTitle>
                <DialogDescription>Create a team for this hackathon (max 4 members)</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Team Name</label>
                  <Input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter team name"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowTeamForm(null)}>Cancel</Button>
                <Button onClick={() => createTeam(showTeamForm)}>Create Team</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Find Teammates Dialog */}
        {showFindTeammates && member && (
          <Dialog open onOpenChange={() => setShowFindTeammates(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Find Teammates</DialogTitle>
                <DialogDescription>Invite approved hackathon participants to join your team</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Message (optional)</label>
                  <Textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="Add a personal message..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Available Members:</p>
                  {/* TODO: Load approved hackathon participants */}
                  <p className="text-sm text-muted-foreground">Loading approved participants...</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowFindTeammates(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

