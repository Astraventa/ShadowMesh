import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Calendar, BookOpen, ExternalLink, Download, Video, Link as LinkIcon, FileText, Users, Trophy, Activity, Send, KeyRound, QrCode, Star, MessageSquare, ChevronRight, ChevronDown, Shield, Eye, EyeOff, MapPin, CheckCircle2, Bell, Check, Sparkles, Award, Megaphone, Crown, Heart } from "lucide-react";
import PremiumBadge from "@/components/PremiumBadge";
import { QRCodeSVG } from "qrcode.react";
import HackathonRegistration from "@/components/HackathonRegistration";
import EventRegistration from "@/components/EventRegistration";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Member {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  cohort?: string;
  area_of_interest?: string;
  password_hash?: string;
  motivation?: string;
  affiliation?: string;
  university_name?: string;
  department?: string;
  roll_number?: string;
  organization?: string;
  role_title?: string;
  phone_e164?: string;
  two_factor_enabled?: boolean;
  two_factor_secret?: string;
  email_verified?: boolean;
  verified_badge?: boolean;
  star_badge?: boolean;
  custom_badge?: string;
  priority_level?: number;
  member_category?: string;
  email_hidden?: boolean;
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
  created_at?: string;
  payment_required?: boolean;
  fee_amount?: number;
  fee_currency?: string;
  category?: string;
  tags?: string[];
  registration_deadline?: string;
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
  to_member_id: string;
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

function LeaderboardSection() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const { data, error } = await supabase
          .from("members")
          .select("id, full_name, email, verified_badge, star_badge, custom_badge, created_at, priority_level, member_category")
          .eq("status", "active")
          .eq("is_hidden", false)
          .order("priority_level", { ascending: false, nullsFirst: false })
          .order("verified_badge", { ascending: false, nullsFirst: false })
          .order("star_badge", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: true })
          .limit(50);

        if (error) throw error;
        setLeaderboard(data || []);
      } catch (error) {
        console.error("Error loading leaderboard:", error);
      } finally {
        setLoading(false);
      }
    }
    void loadLeaderboard();
  }, []);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading leaderboard...</div>;
  }

  return (
    <div className="space-y-2">
      {leaderboard.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No members found</p>
      ) : (
        leaderboard.map((member, index) => {
          const hasVerified = member.verified_badge;
          const hasStar = member.star_badge;
          const rank = index + 1;
          
          return (
            <div
              key={member.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                rank <= 3
                  ? "bg-gradient-to-r from-amber-500/10 to-yellow-500/5 border-amber-500/30"
                  : "bg-muted/30 border-border/50"
              }`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                rank === 1 ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-lg shadow-amber-500/50" :
                rank === 2 ? "bg-gradient-to-br from-gray-300 to-gray-400 text-white shadow-lg shadow-gray-400/50" :
                rank === 3 ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-600/50" :
                "bg-muted text-muted-foreground"
              }`}>
                {rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{member.full_name}</span>
                  <PremiumBadge verified={hasVerified} star={hasStar} custom={member.custom_badge} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground truncate">{member.email}</p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function MemberPortal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [globalResources, setGlobalResources] = useState<Resource[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);
  const [registeredEvents, setRegisteredEvents] = useState<Set<string>>(new Set());
  const [hackathons, setHackathons] = useState<Event[]>([]);
  const [hackathonRegistrations, setHackathonRegistrations] = useState<HackathonRegistration[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamRequests, setTeamRequests] = useState<TeamRequest[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showHackathonReg, setShowHackathonReg] = useState<string | null>(null);
  const [showEventReg, setShowEventReg] = useState<string | null>(null);
  const [showTeamForm, setShowTeamForm] = useState<string | null>(null);
  const [showFindTeammates, setShowFindTeammates] = useState<string | null>(null);
  const [hackathonRegisteredMembers, setHackathonRegisteredMembers] = useState<any[]>([]);
  const [loadingHackathonMembers, setLoadingHackathonMembers] = useState(false);
  const [hackathonTeams, setHackathonTeams] = useState<any[]>([]);
  const [hackathonSinglePlayers, setHackathonSinglePlayers] = useState<any[]>([]);
  const [showJoinTeam, setShowJoinTeam] = useState<string | null>(null);
  const [selectedHackathonForTeams, setSelectedHackathonForTeams] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [expandedHackathons, setExpandedHackathons] = useState<Set<string>>(new Set());
  const [teamName, setTeamName] = useState("");
  const [teamNameError, setTeamNameError] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [showQRCode, setShowQRCode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockUntil, setLockUntil] = useState<Date | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState("general");
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackEventId, setFeedbackEventId] = useState<string | null>(null);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
  const [twoFactorQRCode, setTwoFactorQRCode] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorVerifying, setTwoFactorVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [pendingMemberData, setPendingMemberData] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<any | null>(null);
  const [respondingInvite, setRespondingInvite] = useState(false);

  useEffect(() => {
    // Load viewed hackathons from localStorage (if needed in future)
    // const viewed = localStorage.getItem("shadowmesh_hackathons_viewed");
    // if (viewed) {
    //   try {
    //     setHackathonsViewed(new Set(JSON.parse(viewed)));
    //   } catch (e) {
    //     console.error("Error loading viewed hackathons:", e);
    //   }
    // }

    // Check if user is already authenticated
    const authenticated = localStorage.getItem("shadowmesh_authenticated");
    const storedEmail = localStorage.getItem("shadowmesh_member_email");
    
    // Check for password setup token from welcome email
    const params = new URLSearchParams(window.location.search);
    const setupParam = params.get("setup");
    
    if (setupParam) {
      // User came from welcome email - show password setup
      setSetupToken(setupParam);
      setIsSettingPassword(true);
      setShowLogin(true);
      setLoading(false);
    } else if (authenticated === "true" && storedEmail) {
      // User is authenticated, load data
      loadMemberDataByEmail(storedEmail);
    } else {
      // Show login screen
      setShowLogin(true);
      setLoading(false);
      
      // Pre-fill email if available
      if (storedEmail) {
        setLoginEmail(storedEmail);
      }
    }
  }, []);

  // Realtime: if admin deletes this member, show dismissal popup and redirect
  useEffect(() => {
    if (!member?.id) return;
    const channel = supabase
      .channel(`member-delete-${member.id}`)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'members', filter: `id=eq.${member.id}` }, () => {
        localStorage.removeItem("shadowmesh_authenticated");
        localStorage.removeItem("shadowmesh_member_email");
        alert("Your account has been dismissed by the admin. You will be redirected to the homepage.");
        window.location.href = "/";
      })
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [member?.id]);

  // Realtime: notifications and team requests
  useEffect(() => {
    if (!member?.id) return;
    const channel = supabase
      .channel(`member-notifs-${member.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'member_notifications', filter: `member_id=eq.${member.id}` }, (payload) => {
        try {
          const inserted: any = payload.new;
          setNotifications((prev) => [inserted, ...prev]);
          setUnreadCount((c) => c + 1);
        } catch {}
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_requests', filter: `to_member_id=eq.${member.id}` }, async () => {
        // Reload to synthesize invite notification with team name via join
        await loadNotifications(member.id);
      })
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [member?.id]);

  async function loadMemberDataByEmail(email: string) {
    setLoading(true);
    try {
      if (!email || typeof email !== 'string') {
        throw new Error("Invalid email provided");
      }

      // Get member by email
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("*")
        .eq("email", email.trim().toLowerCase())
        .single();

      if (memberError || !memberData) {
        throw new Error("Member not found. Please ensure your application has been approved.");
      }

      setMember(memberData);
      // Load notifications
      await loadNotifications(memberData.id);
      localStorage.setItem("shadowmesh_member_email", email.trim().toLowerCase());
      localStorage.setItem("shadowmesh_authenticated", "true");

      // Check for pending team invite (elite approach - auto-accept after approval)
      const pendingInviteToken = localStorage.getItem("pending_team_invite");
      if (pendingInviteToken) {
        // Clear the pending invite token
        localStorage.removeItem("pending_team_invite");
        // Redirect to accept invite
        navigate(`/team-invite/${pendingInviteToken}`);
        return; // Don't continue loading - let TeamInvite handle it
      }

      // Track portal access - mark as accessed if not already
      if (!memberData.portal_accessed) {
        const params = new URLSearchParams(window.location.search);
        const setupParam = params.get("setup");
        const joinedFromEmail = !!setupParam; // If setup token exists, user came from email
        
        await supabase
          .from("members")
          .update({
            portal_accessed: true,
            first_portal_access_at: new Date().toISOString(),
            joined_from_email: joinedFromEmail
          })
          .eq("id", memberData.id);
      }

      // Load events (workshops and other events, excluding hackathons)
      // Show all active events, not just future ones
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .neq("event_type", "hackathon")
        .order("created_at", { ascending: false });

      if (eventsError) {
        console.error("Error loading events:", eventsError);
      }
      if (eventsData) {
        console.log("Loaded events:", eventsData.length);
        setEvents(eventsData);
      } else {
        console.log("No events found in database");
      }

      // Load resources filtered by member's area_of_interest
      // Filter by title/description keywords based on area_of_interest
      let resourcesQuery = supabase
        .from("member_resources")
        .select("*")
        .eq("is_active", true);
      
      // Filter by area_of_interest if member has one
      if (memberData.area_of_interest) {
        const interest = memberData.area_of_interest.toLowerCase();
        if (interest === "both" || interest.includes("both")) {
          // Show all resources for "Both" - no filter needed
        } else if (interest.includes("ai") || interest.includes("ml")) {
          // Show AI resources - filter by title/description containing AI/ML keywords
          resourcesQuery = resourcesQuery.or("title.ilike.%ai%,title.ilike.%ml%,title.ilike.%machine learning%,description.ilike.%ai%,description.ilike.%ml%,description.ilike.%machine learning%");
        } else if (interest.includes("cyber") || interest.includes("security")) {
          // Show Cyber resources - filter by title/description containing cyber/security keywords
          resourcesQuery = resourcesQuery.or("title.ilike.%cyber%,title.ilike.%security%,title.ilike.%hack%,description.ilike.%cyber%,description.ilike.%security%,description.ilike.%hack%");
        }
      }
      
      const { data: resourcesData } = await resourcesQuery.order("created_at", { ascending: false });

      if (resourcesData) setResources(resourcesData);

      // Load global resources
      const { data: globalResData } = await supabase
        .from("global_resources")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (globalResData) {
        // Filter by access level
        const filtered = globalResData.filter((res) => {
          if (res.access_level === "all") return true;
          if (res.access_level === "premium" && (memberData.star_badge || memberData.verified_badge)) return true;
          if (res.access_level === "verified" && memberData.verified_badge) return true;
          return false;
        });
        setGlobalResources(filtered);
      }

      // Load announcements
      const { data: annData } = await supabase
        .from("global_announcements")
        .select("*")
        .eq("is_active", true)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);

      if (annData) setAnnouncements(annData);

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
      // Show all active hackathons, order by created_at descending (newest first)
      const { data: hackathonsData } = await supabase
        .from("events")
        .select("*")
        .eq("event_type", "hackathon")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

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

  async function loadPendingTeamRequests(memberId: string) {
    try {
      const { data: teamReqs } = await supabase
        .from("team_requests")
        .select("id, created_at, team_id, status, message")
        .eq("to_member_id", memberId)
        .eq("status", "pending");

      if (!teamReqs || teamReqs.length === 0) {
        return [];
      }

      const teamIds = Array.from(new Set(teamReqs.map((r: any) => r.team_id).filter(Boolean)));
      const { data: teams } = teamIds.length
        ? await supabase
            .from("hackathon_teams")
            .select("id, team_name, hackathon_id, team_leader_id, max_members")
            .in("id", teamIds)
        : { data: [] as any[] };

      const teamMap = new Map<string, any>();
      const leaderIds = new Set<string>();
      const hackathonIds = new Set<string>();
      (teams || []).forEach((teamRow: any) => {
        teamMap.set(teamRow.id, teamRow);
        if (teamRow.team_leader_id) leaderIds.add(teamRow.team_leader_id);
        if (teamRow.hackathon_id) hackathonIds.add(teamRow.hackathon_id);
      });

      const { data: leaders } = leaderIds.size
        ? await supabase
            .from("members")
            .select("id, full_name, email, area_of_interest")
            .in("id", Array.from(leaderIds))
        : { data: [] as any[] };
      const leaderMap = new Map<string, any>();
      (leaders || []).forEach((leader: any) => leaderMap.set(leader.id, leader));

      const { data: hackathons } = hackathonIds.size
        ? await supabase
            .from("events")
            .select("id, title")
            .in("id", Array.from(hackathonIds))
        : { data: [] as any[] };
      const hackathonMap = new Map<string, any>();
      (hackathons || []).forEach((eventRow: any) => hackathonMap.set(eventRow.id, eventRow));

      return teamReqs.map((request: any) => {
        const teamRow = teamMap.get(request.team_id);
        const leaderRow = teamRow ? leaderMap.get(teamRow.team_leader_id) : null;
        const hackathonRow = teamRow ? hackathonMap.get(teamRow.hackathon_id) : null;
        return {
          id: request.id,
          created_at: request.created_at,
          team_id: request.team_id,
          message: request.message,
          team_name: teamRow?.team_name || "Team",
          hackathon_id: teamRow?.hackathon_id || null,
          hackathon_title: hackathonRow?.title || "",
          leader_id: teamRow?.team_leader_id,
          leader_name: leaderRow?.full_name || "Team Leader",
          leader_email: leaderRow?.email || "",
          leader_interest: leaderRow?.area_of_interest || "",
          max_members: teamRow?.max_members || 4,
        };
      });
    } catch (error) {
      console.error("Failed to load pending invites:", error);
      return [];
    }
  }

  async function loadNotifications(memberId: string) {
    try {
      const { data: notifRows } = await supabase
        .from("member_notifications")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(20);
      const pendingInvites = await loadPendingTeamRequests(memberId);
      const synthetic = pendingInvites.map((invite: any) => ({
        id: `teamreq_${invite.id}`,
        notification_type: "team_invite",
        title: "Team Invitation",
        body: `You have been invited to join ${invite.team_name}.`,
        created_at: invite.created_at,
        is_read: false,
        source: "team_request",
        invite,
      }));
      const all = [...(notifRows || []), ...synthetic].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(all);
      setUnreadCount(all.filter(n => !n.is_read).length);
    } catch {}
  }

  async function markAllRead() {
    if (!member) return;
    try {
      await supabase.from("member_notifications").update({ is_read: true }).eq("member_id", member.id).eq("is_read", false);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  }

  function handleNotificationClick(notification: any) {
    if (notification?.source === "team_request" && notification.invite) {
      setSelectedInvite(notification.invite);
      setInviteDialogOpen(true);
      return;
    }
    if (notification?.action_url) {
      navigate(notification.action_url);
    }
  }

  async function respondToInvite(decision: "accepted" | "rejected") {
    if (!selectedInvite || !member) return;
    if (decision === "accepted" && teamMembershipsForHackathon(selectedInvite.hackathon_id)) {
      toast({ title: "Already in a team", description: "Leave your current team before accepting another invite.", variant: "destructive" });
      return;
    }

    setRespondingInvite(true);
    try {
      const nowIso = new Date().toISOString();
      if (decision === "accepted") {
        const { data: teamRow, error: teamError } = await supabase
          .from("hackathon_teams")
          .select("id, max_members")
          .eq("id", selectedInvite.team_id)
          .single();
        if (teamError || !teamRow) throw new Error("Team not found or already deleted.");

        const { data: members } = await supabase
          .from("team_members")
          .select("member_id")
          .eq("team_id", selectedInvite.team_id);

        if (members && members.length >= (teamRow.max_members || 4)) {
          throw new Error("This team is already full.");
        }

        await supabase
          .from("team_members")
          .insert({
            team_id: selectedInvite.team_id,
            member_id: member.id,
            role: "member",
          });

        await supabase
          .from("team_requests")
          .update({ status: "accepted", responded_at: nowIso })
          .eq("id", selectedInvite.id);

        toast({ title: "Invite accepted", description: `You're now part of ${selectedInvite.team_name}.` });
        setInviteDialogOpen(false);
        setSelectedInvite(null);
        await loadNotifications(member.id);
        await loadMemberDataByEmail(member.email);
      } else {
        await supabase
          .from("team_requests")
          .update({ status: "rejected", responded_at: nowIso })
          .eq("id", selectedInvite.id);
        toast({ title: "Invite declined", description: "The team has been notified." });
        setInviteDialogOpen(false);
        setSelectedInvite(null);
        await loadNotifications(member.id);
      }
    } catch (error: any) {
      toast({ title: "Unable to process invite", description: error.message, variant: "destructive" });
    } finally {
      setRespondingInvite(false);
    }
  }

  function teamMembershipsForHackathon(hackathonId?: string | null) {
    if (!hackathonId || !member) return false;
    return hackathonTeams.some((team) => team.hackathon_id === hackathonId && (team.team_leader_id === member.id || team.members?.some((m: any) => m.member_id === member.id)));
  }

  async function handleEventRegistrationSuccess(eventId?: string) {
    if (eventId) {
      setRegisteredEvents((prev) => new Set([...prev, eventId]));
    }
    setShowEventReg(null);
    // Reload member data to refresh registrations
    const token = localStorage.getItem("shadowmesh_member_token");
    if (token) {
      await loadMemberDataByEmail(member?.email || "");
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
    if (!member) return;
    const trimmedName = teamName.trim();
    if (!trimmedName) {
      setTeamNameError("Team name is required.");
      toast({ title: "Team name required", description: "Please enter a team name." });
      return;
    }

    try {
      setTeamNameError(null);

      const { data: existingMembership } = await supabase
        .from("team_members")
        .select("team_id, hackathon_teams(hackathon_id)")
        .eq("member_id", member.id);

      if (Array.isArray(existingMembership) && existingMembership.some((tm: any) => tm.hackathon_teams?.hackathon_id === hackathonId)) {
        toast({ title: "Already in a team", description: "You can only lead or join one team per hackathon.", variant: "destructive" });
        return;
      }

      const { data: existingNames } = await supabase
        .from("hackathon_teams")
        .select("id")
        .eq("hackathon_id", hackathonId)
        .ilike("team_name", trimmedName)
        .limit(1);

      if (existingNames && existingNames.length > 0) {
        setTeamNameError("That team name is already taken for this hackathon.");
        toast({ title: "Name unavailable", description: "Please choose a different team name.", variant: "destructive" });
        return;
      }

      const { data: team, error } = await supabase
        .from("hackathon_teams")
        .insert({
          hackathon_id: hackathonId,
          team_name: trimmedName,
          team_leader_id: member.id,
          status: "forming",
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from("team_members").insert({
        team_id: team.id,
        member_id: member.id,
        role: "leader",
      });

      await supabase.from("member_activity").insert({
        member_id: member.id,
        activity_type: "team_created",
        activity_data: { team_id: team.id, team_name: trimmedName, hackathon_id: hackathonId },
        related_id: team.id,
      });

      toast({ title: "Team created!", description: "You can now invite teammates." });
      setShowTeamForm(null);
      setTeamName("");
      setTeamNameError(null);
      await loadMemberDataByEmail(localStorage.getItem("shadowmesh_member_email") || member.email);
    } catch (e: any) {
      if (String(e?.message || "").includes("duplicate key")) {
        setTeamNameError("That team name is already taken.");
        toast({ title: "Name unavailable", description: "Please choose another name.", variant: "destructive" });
      } else {
        toast({ title: "Failed to create team", description: e.message });
      }
    }
  }

  async function loadHackathonTeamsAndPlayers(hackathonId: string) {
    if (!member) return;
    setLoadingHackathonMembers(true);
    try {
      // Get all approved registrations for this hackathon
      const { data: approvedRegs, error: regError } = await supabase
        .from("hackathon_registrations")
        .select("member_id, members(id, full_name, email, area_of_interest)")
        .eq("hackathon_id", hackathonId)
        .eq("status", "approved");

      if (regError) throw regError;

      // Get all teams for this hackathon with their members
      const { data: teamsData, error: teamsError } = await supabase
        .from("hackathon_teams")
        .select(`
          id,
          team_name,
          team_leader_id,
          status,
          max_members,
          team_members(
            member_id,
            role,
            members(id, full_name, email, area_of_interest)
          )
        `)
        .eq("hackathon_id", hackathonId)
        .eq("status", "forming");

      if (teamsError) throw teamsError;

      // Get all member IDs that are in teams
      const teamMemberIds = new Set<string>();
      const formattedTeams = (teamsData || []).map((team: any) => {
        const members = (team.team_members || []).map((tm: any) => {
          if (tm.member_id) teamMemberIds.add(tm.member_id);
          return {
            member_id: tm.member_id,
            full_name: tm.members?.full_name || "",
            email: tm.members?.email || "",
            area_of_interest: tm.members?.area_of_interest || "",
            role: tm.role,
          };
        });
        return {
          ...team,
          members,
        };
      });

      // Get single players (approved members not in any team)
      const singlePlayers = (approvedRegs || [])
        .filter((r: any) => !teamMemberIds.has(r.member_id))
        .map((r: any) => ({
          id: r.member_id,
          full_name: r.members?.full_name || "",
          email: r.members?.email || "",
          area_of_interest: r.members?.area_of_interest || "",
        }));

      setHackathonTeams(formattedTeams);
      setHackathonSinglePlayers(singlePlayers);
    } catch (e: any) {
      console.error("Failed to load hackathon teams and players:", e);
      toast({ title: "Failed to load data", description: e.message });
    } finally {
      setLoadingHackathonMembers(false);
    }
  }

  async function joinTeam(teamId: string) {
    if (!member) return;
    try {
      // Check if team has space
      const { data: teamData } = await supabase
        .from("hackathon_teams")
        .select("id, max_members, team_members(count)")
        .eq("id", teamId)
        .single();

      if (teamData) {
        const memberCount = Array.isArray(teamData.team_members) ? teamData.team_members.length : 0;
        if (memberCount >= (teamData.max_members || 4)) {
          toast({ title: "Team is full", description: "This team has reached the maximum number of members.", variant: "destructive" });
          return;
        }
      }

      // Add member to team
      const { error } = await supabase.from("team_members").insert({
        team_id: teamId,
        member_id: member.id,
        role: "member",
      });

      if (error) throw error;

      // Log activity
      await supabase.from("member_activity").insert({
        member_id: member.id,
        activity_type: "team_joined",
        activity_data: { team_id: teamId },
        related_id: teamId,
      });

      toast({ title: "Joined team!", description: "You've successfully joined the team." });
      setShowJoinTeam(null);
      void loadMemberDataByEmail(localStorage.getItem("shadowmesh_member_email") || "");
      if (selectedHackathonForTeams) {
        void loadHackathonTeamsAndPlayers(selectedHackathonForTeams);
      }
    } catch (e: any) {
      toast({ title: "Failed to join team", description: e.message, variant: "destructive" });
    }
  }

  async function loadHackathonRegisteredMembers(hackathonId: string) {
    if (!member) return;
    setLoadingHackathonMembers(true);
    try {
      // Get all approved registrations for this hackathon
      const { data, error } = await supabase
        .from("hackathon_registrations")
        .select("member_id, members(id, full_name, email, area_of_interest)")
        .eq("hackathon_id", hackathonId)
        .eq("status", "approved");

      if (error) throw error;

      // Filter out current member and members already in teams
      const memberIds = new Set((data || []).map((r: any) => r.member_id));
      
      // Get all teams for this hackathon
      const { data: teamsData } = await supabase
        .from("hackathon_teams")
        .select("id, team_members(member_id)")
        .eq("hackathon_id", hackathonId);

      const teamMemberIds = new Set<string>();
      if (teamsData) {
        teamsData.forEach((team: any) => {
          if (team.team_members && Array.isArray(team.team_members)) {
            team.team_members.forEach((tm: any) => {
              if (tm.member_id) {
                teamMemberIds.add(tm.member_id);
              }
            });
          }
        });
      }

      // Filter: exclude current member and members already in teams
      const availableMembers = (data || [])
        .filter((r: any) => r.member_id !== member.id && !teamMemberIds.has(r.member_id))
        .map((r: any) => ({
          id: r.member_id,
          ...r.members,
        }));

      setHackathonRegisteredMembers(availableMembers);
    } catch (e: any) {
      console.error("Failed to load hackathon members:", e);
      toast({ title: "Failed to load members", description: e.message });
    } finally {
      setLoadingHackathonMembers(false);
    }
  }

  async function sendTeamRequest(teamId: string, toMemberId: string) {
    if (!member) return;

    try {
      // Check if team is full
      const { data: teamData } = await supabase
        .from("hackathon_teams")
        .select("id, max_members, team_members(count)")
        .eq("id", teamId)
        .single();

      if (teamData) {
        const memberCount = Array.isArray(teamData.team_members) ? teamData.team_members.length : 0;
        if (memberCount >= (teamData.max_members || 4)) {
          toast({ title: "Team is full", description: "This team has reached the maximum number of members.", variant: "destructive" });
          return;
        }
      }

      // Check if request already exists
      const { data: existingRequest } = await supabase
        .from("team_requests")
        .select("id, status")
        .eq("team_id", teamId)
        .eq("to_member_id", toMemberId)
        .eq("status", "pending")
        .single();

      if (existingRequest) {
        toast({ title: "Request already sent", description: "You've already sent an invitation to this member.", variant: "default" });
        return;
      }

      const { error } = await supabase.from("team_requests").insert({
        team_id: teamId,
        from_member_id: member.id,
        to_member_id: toMemberId,
        message: requestMessage.trim() || null,
        status: "pending",
      });

      if (error) throw error;

      toast({ title: "Invitation sent!", description: "The member will be notified and can accept your invitation." });
      setRequestMessage("");
      void loadMemberDataByEmail(localStorage.getItem("shadowmesh_member_email") || "");
      void loadHackathonRegisteredMembers(showFindTeammates || "");
    } catch (e: any) {
      toast({ title: "Failed to send invitation", description: e.message, variant: "destructive" });
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
      void loadMemberDataByEmail(localStorage.getItem("shadowmesh_member_email") || "");
    } catch (e: any) {
      toast({ title: "Failed to respond", description: e.message });
    }
  }

  async function handleLogin() {
    // For password setup via welcome email link, allow proceeding without typing email
    const requiresEmail = !(setupToken && isSettingPassword);
    if (requiresEmail && !loginEmail.trim()) {
      toast({ title: "Email required", description: "Please enter your registered email address." });
      return;
    }

    // Check if account is locked
    if (isLocked && lockUntil && new Date() < lockUntil) {
      const minutesLeft = Math.ceil((lockUntil.getTime() - new Date().getTime()) / 60000);
      toast({ 
        title: "Account temporarily locked", 
        description: `Too many failed attempts. Please try again in ${minutesLeft} minute(s).`,
        variant: "destructive"
      });
      return;
    }

    // Reset lock if time has passed
    if (isLocked && lockUntil && new Date() >= lockUntil) {
      setIsLocked(false);
      setLockUntil(null);
      setFailedAttempts(0);
    }

    try {
      setLoading(true);
      
      // Get member either by email (normal flow) or by setup token (welcome email flow)
      let memberData: any = null;
      let memberError: any = null;
      if (setupToken && isSettingPassword) {
        const { data, error } = await supabase
          .from("members")
          .select("*")
          .eq("password_reset_token", setupToken)
          .single();
        memberData = data;
        memberError = error;
        if (data?.email && !loginEmail) {
          setLoginEmail(data.email);
        }
      } else {
        const { data, error } = await supabase
          .from("members")
          .select("*")
          .eq("email", loginEmail.trim().toLowerCase())
          .single();
        memberData = data;
        memberError = error;
      }

      if (memberError || !memberData) {
        throw new Error("Member not found. Please ensure your application has been approved.");
      }

      // Handle password setup from welcome email token
      if (setupToken && isSettingPassword) {
        // Verify setup token
        if (memberData.password_reset_token !== setupToken) {
          throw new Error("Invalid setup token. Please use the link from your welcome email.");
        }
        
        const expiresAt = memberData.password_reset_expires ? new Date(memberData.password_reset_expires) : null;
        if (expiresAt && new Date() > expiresAt) {
          throw new Error("Setup token has expired. Please request a new password reset.");
        }

        if (!newPassword || !confirmPassword) {
          toast({ title: "Password required", description: "Please enter and confirm your password." });
          return;
        }
        
        if (newPassword.length < 8) {
          toast({ title: "Password too short", description: "Password must be at least 8 characters." });
          return;
        }
        
        // Check password strength
        const hasUpperCase = /[A-Z]/.test(newPassword);
        const hasLowerCase = /[a-z]/.test(newPassword);
        const hasNumbers = /\d/.test(newPassword);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
        
        if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
          toast({ 
            title: "Weak password", 
            description: "Password must contain uppercase, lowercase, numbers, and special characters.",
            variant: "destructive"
          });
          return;
        }
        
        if (newPassword !== confirmPassword) {
          toast({ title: "Passwords don't match", description: "Please make sure both passwords match." });
          return;
        }

        // Hash password using PBKDF2 (secure key derivation)
        // Use member's email for consistent salt generation
        const passwordHash = await hashPassword(newPassword, memberData.email);
        
        // Update member with password and clear setup token
        const { error: updateError } = await supabase
          .from("members")
          .update({ 
            password_hash: passwordHash,
            password_reset_token: null,
            password_reset_expires: null,
            email_verified: true
          })
          .eq("id", memberData.id);

        if (updateError) throw updateError;
        
        toast({ title: "Password set!", description: "Your password has been set successfully. You can now log in." });
        setIsSettingPassword(false);
        setSetupToken(null);
        setNewPassword("");
        setConfirmPassword("");
        // Don't auto-login, let them log in with email+password
        return;
      }

      // Check if password is set
      if (!memberData.password_hash) {
        // First time login - require password setup
        toast({ 
          title: "Password not set", 
          description: "Please check your email for the password setup link, or use 'Forgot Password' to set one.",
          variant: "destructive"
        });
        return;
      }

      // Password is set - verify it
      if (!loginPassword) {
        toast({ title: "Password required", description: "Please enter your password." });
        return;
      }

      // Verify password using member's email for consistent salt
      const isValid = await verifyPassword(loginPassword, memberData.password_hash, memberData.email);
      if (!isValid) {
        // Increment failed attempts
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);
        
        // Lock account after 3 failed attempts
        if (newFailedAttempts >= 3) {
          const lockTime = new Date();
          lockTime.setMinutes(lockTime.getMinutes() + 15); // Lock for 15 minutes
          setIsLocked(true);
          setLockUntil(lockTime);
          setShowForgotPassword(true);
          
          toast({ 
            title: "Account locked", 
            description: "Too many failed attempts. Account locked for 15 minutes. Use 'Forgot Password' to reset.",
            variant: "destructive"
          });
        } else {
          toast({ 
            title: "Invalid password", 
            description: `Incorrect password. ${3 - newFailedAttempts} attempt(s) remaining.`,
            variant: "destructive"
          });
        }
        return;
      }
      
      // Successful password verification - reset failed attempts
      setFailedAttempts(0);
      setIsLocked(false);
      setLockUntil(null);
      setShowForgotPassword(false);

      // Check if 2FA is enabled or a secret exists (configured on account)
      if (memberData.two_factor_enabled || !!memberData.two_factor_secret) {
        // Require 2FA code
        setNeeds2FA(true);
        setPendingMemberData(memberData);
        setLoginPassword(""); // Clear password for security
        return;
      }

      // No 2FA, proceed with login
      setMember(memberData);
      localStorage.setItem("shadowmesh_member_email", loginEmail.trim().toLowerCase());
      localStorage.setItem("shadowmesh_authenticated", "true");
      setShowLogin(false);
      setLoginPassword("");
      setLoginEmail("");
      setFailedAttempts(0);
      setIsLocked(false);
      setLockUntil(null);
      setShowForgotPassword(false);
      
      // Load member data
      await loadMemberDataByEmail(loginEmail.trim().toLowerCase());
    } catch (e: any) {
      toast({ title: "Login failed", description: e.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function hashPassword(password: string, email: string): Promise<string> {
    // Enhanced password hashing with PBKDF2 for better security
    // Using PBKDF2 with 100,000 iterations to resist brute force attacks
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    
    // Generate salt from email (deterministic but unique per user)
    // Use email to ensure consistent salt generation
    const saltData = encoder.encode(email.trim().toLowerCase() + "shadowmesh_salt");
    
    // Import key for PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      passwordData,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    
    // Derive key with 100,000 iterations (slows down brute force attacks)
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltData,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );
    
    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(derivedBits));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function verifyPassword(password: string, hash: string, email: string): Promise<boolean> {
    const passwordHash = await hashPassword(password, email);
    return passwordHash === hash;
  }

  async function handleSetup2FA() {
    if (!member) return;
    
    try {
      setTwoFactorVerifying(true);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/two_factor_auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "setup",
          memberId: member.id,
          email: member.email,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to setup 2FA");
      }

      setTwoFactorSecret(data.secret);
      setTwoFactorQRCode(data.qrCodeUri);
      toast({ title: "2FA Setup", description: "Scan the QR code with your authenticator app." });
    } catch (e: any) {
      toast({ title: "Setup failed", description: e.message || "Please try again.", variant: "destructive" });
    } finally {
      setTwoFactorVerifying(false);
    }
  }

  async function handleEnable2FA() {
    if (!member || !twoFactorCode.trim()) {
      toast({ title: "Code required", description: "Please enter the 6-digit code from your authenticator app." });
      return;
    }

    try {
      setTwoFactorVerifying(true);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/two_factor_auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "enable",
          memberId: member.id,
          otp: twoFactorCode.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to enable 2FA");
      }

      toast({ title: "2FA Enabled", description: "Two-factor authentication is now active on your account." });
      setShow2FASetup(false);
      setTwoFactorCode("");
      setTwoFactorSecret(null);
      setTwoFactorQRCode(null);
      // Reload member data
      await loadMemberDataByEmail(member.email);
    } catch (e: any) {
      toast({ title: "Enable failed", description: e.message || "Invalid code. Please try again.", variant: "destructive" });
    } finally {
      setTwoFactorVerifying(false);
    }
  }

  async function handleDisable2FA() {
    if (!member) return;
    
    if (!confirm("Are you sure you want to disable 2FA? This will reduce your account security.")) {
      return;
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/two_factor_auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "disable",
          memberId: member.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to disable 2FA");
      }

      toast({ title: "2FA Disabled", description: "Two-factor authentication has been disabled." });
      // Reload member data
      await loadMemberDataByEmail(member.email);
    } catch (e: any) {
      toast({ title: "Disable failed", description: e.message || "Please try again.", variant: "destructive" });
    }
  }

  async function handle2FALogin() {
    if (!twoFactorCode.trim() || twoFactorCode.length !== 6) {
      toast({ title: "Code required", description: "Please enter the 6-digit code from your authenticator app." });
      return;
    }

    if (!pendingMemberData) {
      toast({ title: "Session expired", description: "Please log in again.", variant: "destructive" });
      setNeeds2FA(false);
      setTwoFactorCode("");
      setPendingMemberData(null);
      return;
    }

    try {
      setTwoFactorVerifying(true);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/two_factor_auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "verify",
          memberId: pendingMemberData.id,
          otp: twoFactorCode.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Invalid 2FA code");
      }

      // 2FA verified - complete login
      setMember(pendingMemberData);
      localStorage.setItem("shadowmesh_member_email", pendingMemberData.email);
      localStorage.setItem("shadowmesh_authenticated", "true");
      setShowLogin(false);
      setNeeds2FA(false);
      setTwoFactorCode("");
      setPendingMemberData(null);
      setLoginPassword("");
      setLoginEmail("");
      setFailedAttempts(0);
      setIsLocked(false);
      setLockUntil(null);
      setShowForgotPassword(false);
      
      // Load member data
      await loadMemberDataByEmail(pendingMemberData.email);
    } catch (e: any) {
      toast({ title: "Verification failed", description: e.message || "Invalid code. Please try again.", variant: "destructive" });
    } finally {
      setTwoFactorVerifying(false);
    }
  }

  async function handleForgotPassword() {
    if (!resetEmail.trim()) {
      toast({ title: "Email required", description: "Please enter your registered email address." });
      return;
    }

    try {
      setLoading(true);
      
      // Call password reset edge function with rate limiting
      const response = await fetch(`${SUPABASE_URL}/functions/v1/password_reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "request",
          email: resetEmail.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast({ 
            title: "Too many requests", 
            description: data.message || "Please try again later.",
            variant: "destructive"
          });
        } else {
          toast({ 
            title: "Reset link sent", 
            description: "If this email is registered, you will receive password reset instructions via email.",
          });
        }
        return;
      }

      toast({ 
        title: "Reset link sent", 
        description: data.message || "If this email is registered, you will receive password reset instructions via email.",
      });
      
    } catch (e: any) {
      // Still show generic message for security
      toast({ 
        title: "Reset link sent", 
        description: "If this email is registered, you will receive password reset instructions.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function submitFeedback() {
    if (!member || !feedbackMessage.trim()) {
      toast({ title: "Message required", description: "Please enter your feedback message." });
      return;
    }

    try {
      const { error } = await supabase
        .from("member_feedback")
        .insert({
          member_id: member.id,
          feedback_type: feedbackType,
          subject: feedbackSubject.trim() || null,
          message: feedbackMessage.trim(),
          rating: feedbackRating || null,
          related_event_id: feedbackEventId || null,
          status: "new",
        });

      if (error) throw error;

      toast({ title: "Feedback submitted!", description: "Thank you for your feedback. We'll review it soon." });
      setShowFeedback(false);
      setFeedbackType("general");
      setFeedbackSubject("");
      setFeedbackMessage("");
      setFeedbackRating(null);
      setFeedbackEventId(null);
    } catch (e: any) {
      toast({ title: "Failed to submit feedback", description: e.message || "Please try again." });
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

  // Show login screen if not authenticated
  if (showLogin && !member) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
        <Card className="w-full max-w-md bg-gradient-to-br from-background/90 to-background/70 backdrop-blur-sm border-border/50">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <KeyRound className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">
              {needs2FA ? "Two-Factor Authentication" : "ShadowMesh Portal"}
            </CardTitle>
            <CardDescription className="text-center">
              {needs2FA
                ? "Enter the 6-digit code from your authenticator app"
                : isSettingPassword && setupToken 
                  ? "Set up your password to access your member dashboard"
                  : "Enter your email and password to access your member dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {needs2FA ? (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    2FA Code
                  </label>
                  <Input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setTwoFactorCode(val);
                    }}
                    placeholder="000000"
                    maxLength={6}
                    disabled={twoFactorVerifying}
                    autoComplete="one-time-code"
                    className="text-center text-2xl tracking-widest font-mono"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && twoFactorCode.length === 6) {
                        handle2FALogin();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Enter the 6-digit code from your authenticator app (Google Authenticator, Authy, etc.)
                  </p>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                  onClick={handle2FALogin}
                  disabled={twoFactorCode.length !== 6 || twoFactorVerifying || loading}
                >
                  {twoFactorVerifying ? "Verifying..." : "Verify & Login"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setNeeds2FA(false);
                    setTwoFactorCode("");
                    setPendingMemberData(null);
                    setLoginEmail("");
                    setLoginPassword("");
                  }}
                >
                  Back to Login
                </Button>
              </>
            ) : !isSettingPassword && (
              <div>
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <Input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value.toLowerCase())}
                  placeholder="your.email@example.com"
                  className="text-center"
                  disabled={loading}
                />
              </div>
            )}
            
            {isSettingPassword ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Set Password (min 8 characters, must include uppercase, lowercase, numbers, and special characters)</label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Confirm Password</label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={loading}
                    className="pr-10"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleLogin();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
            
            <Button
              className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "Loading..." : isSettingPassword ? "Set Password & Login" : "Login"}
            </Button>
            
            {isSettingPassword && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIsSettingPassword(false);
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
            
            {showForgotPassword && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                <p className="text-sm text-yellow-400 mb-2">
                  Account locked after 3 failed attempts. Use forgot password to reset.
                </p>
                <div className="space-y-2">
                  <Input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    disabled={loading}
                  />
                  <Button
                    variant="outline"
                    className="w-full border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20"
                    onClick={handleForgotPassword}
                    disabled={loading || !resetEmail.trim()}
                  >
                    Reset Password
                  </Button>
                </div>
              </div>
            )}
            
            {isLocked && lockUntil && (
              <p className="text-xs text-destructive text-center mt-2">
                ⚠️ Account locked. Try again in {Math.ceil((lockUntil.getTime() - new Date().getTime()) / 60000)} minute(s).
              </p>
            )}
            
            <p className="text-xs text-muted-foreground text-center mt-4">
              🔒 Your password protects your account. Keep it secure.
            </p>
          </CardContent>
        </Card>
      </div>
    );
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
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className={`text-5xl font-bold mb-3 bg-clip-text text-transparent ${
                  (member.priority_level || 0) >= 90 
                    ? "bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 animate-pulse" 
                    : (member.priority_level || 0) >= 50
                    ? "bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600"
                    : member.verified_badge
                    ? "bg-gradient-to-r from-blue-400 via-cyan-500 to-blue-600"
                    : member.star_badge
                    ? "bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600"
                    : "bg-gradient-to-r from-primary via-purple-500 to-primary"
                }`}>
                  {isFirstTime ? "Welcome" : "Welcome back"}, {member.full_name.split(' ')[0]}!
                </h1>
                <div className="flex items-center gap-2 mb-3">
                  <PremiumBadge 
                    verified={member.verified_badge} 
                    star={member.star_badge} 
                    custom={member.custom_badge} 
                    size="lg" 
                  />
                </div>
              </div>
              <p className="text-lg text-muted-foreground">ShadowMesh Member Portal • Your gateway to AI × Cyber</p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] rounded-full px-1.5 py-0.5">
                        {unreadCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => void markAllRead()}>
                        <Check className="w-4 h-4 mr-1" /> Mark all read
                      </Button>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No notifications yet</div>
                  ) : (
                    notifications.map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        className="flex flex-col items-start gap-1 cursor-pointer"
                        onSelect={(event) => {
                          event.preventDefault();
                          handleNotificationClick(n);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${n.is_read ? "bg-muted" : "bg-primary"}`}></span>
                          <span className="font-medium">{n.title || (n.notification_type === "team_invite" ? "Team Invitation" : "Update")}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{n.body || n.message || ""}</div>
                        <div className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Badge variant="secondary" className="px-4 py-2 text-sm">
                <KeyRound className="w-4 h-4 mr-2" />
                {member.email}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQRCode(true)}
                className="border-primary/30 hover:border-primary/50"
              >
                <QrCode className="w-4 h-4 mr-2" />
                QR Code
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowFeedback(true)}
                className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Feedback
              </Button>
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

        {/* Announcements Display */}
        {announcements.length > 0 && announcements.filter(a => a.display_position === "top").map((ann) => {
          const animationClass = {
            pulse: "animate-pulse",
            bounce: "animate-bounce",
            shake: "animate-pulse",
            glow: "animate-pulse shadow-lg shadow-primary/50",
            none: "",
          }[ann.animation_type] || "";
          
          return (
            <div
              key={ann.id}
              className={`mb-4 p-4 rounded-lg border-2 border-primary/30 bg-gradient-to-r from-primary/10 to-purple-500/10 cursor-pointer transition-all hover:scale-[1.02] ${animationClass}`}
              onClick={() => setSelectedAnnouncement(ann)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Megaphone className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-semibold text-lg">{ann.title}</h3>
                    {ann.description && <p className="text-sm text-muted-foreground">{ann.description}</p>}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          );
        })}

        <Tabs defaultValue="events" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-muted/50 backdrop-blur-sm border border-border/50 p-1 rounded-lg">
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
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Award className="w-4 h-4 mr-2" />
              Leaderboard
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
                {events.map((event) => {
                  const isNew = new Date(event.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000);
                  const isExpanded = expandedEvents.has(event.id);
                  return (
                    <Card 
                      key={event.id} 
                      className="bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 relative overflow-hidden"
                    >
                      {isNew && (
                        <div className="absolute top-2 right-2 z-10">
                          <Badge variant="destructive">NEW</Badge>
                        </div>
                      )}
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <CardTitle className="text-xl mb-2">{event.title}</CardTitle>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
                                {event.event_type}
                              </Badge>
                              <span className="text-sm text-muted-foreground">•</span>
                              <Badge variant="secondary" className="text-xs">Upcoming</Badge>
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
                        {event.description && !isExpanded && (
                          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{event.description}</p>
                        )}
                        {isExpanded && (
                          <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                            {event.description && (
                              <div>
                                <p className="text-sm font-medium mb-1">Description</p>
                                <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {event.start_date && (
                                <div>
                                  <p className="text-muted-foreground mb-1">Start Date</p>
                                  <p>{formatDate(event.start_date)}</p>
                                </div>
                              )}
                              {event.end_date && (
                                <div>
                                  <p className="text-muted-foreground mb-1">End Date</p>
                                  <p>{formatDate(event.end_date)}</p>
                                </div>
                              )}
                              {event.location && (
                                <div className="col-span-2">
                                  <p className="text-muted-foreground mb-1">📍 Location</p>
                                  <p>{event.location}</p>
                                </div>
                              )}
                              {event.max_participants && (
                                <div>
                                  <p className="text-muted-foreground mb-1">Max Participants</p>
                                  <p>{event.max_participants}</p>
                                </div>
                              )}
                              {event.registration_deadline && (
                                <div>
                                  <p className="text-muted-foreground mb-1">Registration Deadline</p>
                                  <p>{formatDate(event.registration_deadline)}</p>
                                </div>
                              )}
                              {event.payment_required && event.fee_amount && (
                                <div className="col-span-2">
                                  <p className="text-muted-foreground mb-1">Fee</p>
                                  <p className="font-semibold">{event.fee_amount} {event.fee_currency}</p>
                                </div>
                              )}
                              {event.category && (
                                <div>
                                  <p className="text-muted-foreground mb-1">Category</p>
                                  <Badge variant="outline" className="capitalize">{event.category}</Badge>
                                </div>
                              )}
                              {event.tags && Array.isArray(event.tags) && event.tags.length > 0 && (
                                <div className="col-span-2">
                                  <p className="text-muted-foreground mb-1">Tags</p>
                                  <div className="flex flex-wrap gap-1">
                                    {event.tags.filter((tag: any) => tag && typeof tag === 'string').map((tag: string, idx: number) => (
                                      <Badge key={idx} variant="secondary" className="text-xs">{tag}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            {event.registration_link && (
                              <div>
                                <Button variant="outline" size="sm" asChild className="w-full">
                                  <a href={event.registration_link} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    External Registration Link
                                  </a>
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        {!isExpanded && (
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
                            {event.registration_deadline && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">📅</span>
                                <span>Registration deadline: {formatDate(event.registration_deadline)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newExpanded = new Set(expandedEvents);
                              if (isExpanded) {
                                newExpanded.delete(event.id);
                              } else {
                                newExpanded.add(event.id);
                              }
                              setExpandedEvents(newExpanded);
                            }}
                            className="flex items-center gap-1"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                Less
                              </>
                            ) : (
                              <>
                                <ChevronRight className="w-4 h-4" />
                                More Details
                              </>
                            )}
                          </Button>
                          {registeredEvents.has(event.id) ? (
                            <Button variant="secondary" className="flex-1" disabled>
                              Already Registered
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                              onClick={() => setShowEventReg(event.id)}
                            >
                              Register Now
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Badge Values Section */}
              <Card className="shadow-xl border-2">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-primary" />
                    Badge Values
                  </CardTitle>
                  <CardDescription>Understanding our premium badge system</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Verified Badge */}
                  <div className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-lg border border-blue-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 shadow-lg shadow-blue-500/50 border-2 border-blue-400/80 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Verified Badge</h3>
                        <p className="text-xs text-muted-foreground">Top Priority - Premium Elite</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Awarded to core team members, admins, and verified contributors. Represents the highest level of trust and recognition in the ShadowMesh community.
                    </p>
                  </div>

                  {/* Star Badge */}
                  <div className="p-4 bg-gradient-to-br from-amber-500/10 to-yellow-600/5 rounded-lg border border-amber-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 shadow-lg shadow-amber-500/50 border-2 border-amber-300/80 flex items-center justify-center">
                        <Star className="w-5 h-5 text-white fill-white" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Star Badge</h3>
                        <p className="text-xs text-muted-foreground">Second Priority - Special Contributor</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Awarded to special friends, active contributors, and members who go above and beyond. Recognizes exceptional dedication and value to the community.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Leaderboard Section */}
              <Card className="shadow-xl border-2">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-primary" />
                    Member Leaderboard
                  </CardTitle>
                  <CardDescription>Top members ranked by priority, badges, and activity. This is a community ranking system showing active members, not hackathon winners.</CardDescription>
                </CardHeader>
                <CardContent>
                  <LeaderboardSection />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {resources.length === 0 && globalResources.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No resources available at the moment.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {globalResources.map((resource) => (
                    <Card key={`global-${resource.id}`}>
                      <CardHeader>
                        <div className="flex items-center gap-2 mb-2">
                          {getResourceIcon(resource.resource_type)}
                          <CardTitle className="text-lg">{resource.title}</CardTitle>
                          <Badge variant="secondary" className="ml-auto">Global</Badge>
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
                  ))}
                  {resources.map((resource) => (
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
                  ))}
                </>
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
                  const isNew = new Date(hackathon.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000);
                  const isExpanded = expandedHackathons.has(hackathon.id);
                  const formattedDeadline = hackathon.registration_deadline ? formatDate(hackathon.registration_deadline) : null;
                  const formattedStart = hackathon.start_date ? formatDate(hackathon.start_date) : null;
                  const deadlinePassed = hackathon.registration_deadline ? new Date(hackathon.registration_deadline).getTime() < Date.now() : false;
                  const typeLabel = (hackathon.event_type || "Hackathon").toLowerCase();
                  const typeTitle = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);

                  return (
                    <Card 
                      key={hackathon.id} 
                      className="bg-gradient-to-br from-[#140114] via-[#1a0724] to-[#05010a] backdrop-blur-sm border-fuchsia-800/40 hover:border-fuchsia-500/70 transition-all duration-300 hover:shadow-lg hover:shadow-fuchsia-500/20 relative overflow-hidden"
                    >
                      {/* Aurora Glow */}
                      <div className="absolute -top-16 -right-10 w-56 h-56 bg-gradient-to-br from-amber-400/30 via-fuchsia-500/20 to-purple-600/30 blur-3xl opacity-80 pointer-events-none" />
                      <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-purple-500/20 via-indigo-500/10 to-transparent blur-3xl opacity-80 pointer-events-none" />
                      {isNew && (
                        <div className="absolute top-2 right-2 z-10">
                          <Badge variant="destructive">NEW</Badge>
                        </div>
                      )}
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <CardTitle className="text-3xl font-extrabold mb-2 flex items-center gap-3 bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300 text-transparent bg-clip-text drop-shadow-sm">
                              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/80 to-pink-500/80">
                                <Trophy className="w-5 h-5 text-white" />
                              </span>
                              {hackathon.title}
                            </CardTitle>
                            <div className="flex items-center gap-2 flex-wrap text-pink-100/80">
                              <Badge variant="outline" className="bg-pink-900/40 border-pink-500/50 text-pink-100 uppercase tracking-wider">
                                {typeTitle}
                              </Badge>
                              <span className="text-sm">•</span>
                              <Badge variant="secondary" className="text-xs bg-amber-900/40 text-amber-200 border-amber-600/40">Upcoming</Badge>
                              {formattedStart && (
                                <>
                                  <span className="text-sm">•</span>
                                  <span className="inline-flex items-center gap-1 text-sm">
                                    <Calendar className="w-3 h-3 text-amber-300" />
                                    {formattedStart}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-pink-100/80">
                              <div className="flex items-center gap-3">
                                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-500/30">
                                  <MapPin className="w-4 h-4 text-amber-200" />
                                </span>
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-pink-200/70">Location</p>
                                  <p className="font-medium text-pink-50">{hackathon.location || "Location TBA"}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/25 to-orange-500/25">
                                  <Calendar className="w-4 h-4 text-amber-100" />
                                </span>
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-pink-200/70">Registration Deadline</p>
                                  <p className={`font-medium ${deadlinePassed ? "text-red-300" : "text-amber-100"}`}>
                                    {formattedDeadline || "Open"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          {isApproved && (
                            <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                              ✓ Approved
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {hackathon.description && !isExpanded && (
                          <p className="text-sm leading-relaxed line-clamp-2 text-pink-200/90 drop-shadow-[0_0_8px_rgba(236,72,153,0.25)]">
                            {hackathon.description}
                          </p>
                        )}
                        {isExpanded && (
                          <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                            {hackathon.description && (
                              <div>
                                <p className="text-sm font-medium mb-1">Description</p>
                                <p className="text-sm leading-relaxed text-pink-200/90 drop-shadow-[0_0_8px_rgba(236,72,153,0.25)]">
                                  {hackathon.description}
                                </p>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {hackathon.start_date && (
                                <div>
                                  <p className="text-muted-foreground mb-1">Start Date</p>
                                  <p>{formatDate(hackathon.start_date)}</p>
                                </div>
                              )}
                              {hackathon.end_date && (
                                <div>
                                  <p className="text-muted-foreground mb-1">End Date</p>
                                  <p>{formatDate(hackathon.end_date)}</p>
                                </div>
                              )}
                              {hackathon.max_participants && (
                                <div>
                                  <p className="text-muted-foreground mb-1">Max Participants</p>
                                  <p>{hackathon.max_participants}</p>
                                </div>
                              )}
                              {hackathon.registration_deadline && (
                                <div>
                                  <p className="text-muted-foreground mb-1">Registration Deadline</p>
                                  <p>{formatDate(hackathon.registration_deadline)}</p>
                                </div>
                              )}
                              {hackathon.payment_required && hackathon.fee_amount && (
                                <div className="col-span-2">
                                  <p className="text-muted-foreground mb-1">Fee</p>
                                  <p className="font-semibold">{hackathon.fee_amount} {hackathon.fee_currency}</p>
                                </div>
                              )}
                              {hackathon.category && (
                                <div>
                                  <p className="text-muted-foreground mb-1">Category</p>
                                  <Badge variant="outline" className="capitalize">{hackathon.category}</Badge>
                                </div>
                              )}
                              {hackathon.tags && Array.isArray(hackathon.tags) && hackathon.tags.length > 0 && (
                                <div className="col-span-2">
                                  <p className="text-muted-foreground mb-1">Tags</p>
                                  <div className="flex flex-wrap gap-1">
                                    {hackathon.tags.filter((tag: any) => tag && typeof tag === 'string').map((tag: string, idx: number) => (
                                      <Badge key={idx} variant="secondary" className="text-xs">{tag}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            {hackathon.registration_link && (
                              <div>
                                <Button variant="outline" size="sm" asChild className="w-full">
                                  <a href={hackathon.registration_link} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    External Registration Link
                                  </a>
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        {!isExpanded && (
                          <div className="space-y-2 text-sm">
                            {hackathon.location && (
                              <div className="flex items-center gap-2 text-red-100/90">
                                <span>📍</span>
                                <span>{hackathon.location}</span>
                              </div>
                            )}
                            {hackathon.registration_deadline && (
                              <div className="flex items-center gap-2 text-red-100/90">
                                <span>📅</span>
                                <span>Registration deadline: {formatDate(hackathon.registration_deadline)}</span>
                              </div>
                            )}
                            {hackathon.max_participants && (
                              <div className="flex items-center gap-2 text-red-100/90">
                                <span>👥</span>
                                <span>Max {hackathon.max_participants} participants</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newExpanded = new Set(expandedHackathons);
                              if (isExpanded) {
                                newExpanded.delete(hackathon.id);
                              } else {
                                newExpanded.add(hackathon.id);
                              }
                              setExpandedHackathons(newExpanded);
                            }}
                            className="flex items-center gap-1"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                Less
                              </>
                            ) : (
                              <>
                                <ChevronRight className="w-4 h-4" />
                                More Details
                              </>
                            )}
                          </Button>
                          {!reg ? (
                            <Button 
                              variant="default" 
                              className={`flex-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-600/90 hover:to-purple-800/90 ${deadlinePassed ? "opacity-70 hover:opacity-70 cursor-not-allowed" : ""}`}
                              onClick={() => {
                                if (deadlinePassed) {
                                  toast({
                                    title: `${typeTitle} registration closed`,
                                    description: formattedDeadline
                                      ? `Registration closed on ${formattedDeadline}.`
                                      : "The registration deadline has passed.",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                setShowHackathonReg(hackathon.id);
                              }}
                            >
                              {deadlinePassed ? "Registration Closed" : `Register for ${typeTitle}`}
                            </Button>
                          ) : null}
                        </div>
                        
                        {!reg ? (
                          <div className="mt-2">
                            {deadlinePassed ? (
                              <p className="text-sm text-red-300/80">
                                Registration closed for this {typeLabel}. Please watch your email for future opportunities.
                              </p>
                            ) : hackathon.payment_required ? (
                              <p className="text-sm text-muted-foreground">This {typeLabel} requires payment and registration.</p>
                            ) : (
                              <p className="text-sm text-muted-foreground">Register to participate in this {typeLabel}.</p>
                            )}
                          </div>
                        ) : reg.status === "pending" ? (
                          <div className="space-y-2">
                            <Badge variant="outline">Registration Pending</Badge>
                            <p className="text-sm text-muted-foreground">Your registration is under review. You'll be notified once approved.</p>
                          </div>
                        ) : reg.status === "approved" ? (
                          <div className="space-y-4">
                            <Badge variant="secondary">✓ Approved for Hackathon</Badge>
                            <Button 
                              variant="default" 
                              className="w-full bg-gradient-to-r from-green-600 to-green-800 hover:from-green-600/90 hover:to-green-800/90"
                              asChild
                            >
                              <Link to={`/hackathons/${hackathon.id}`}>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Go to Hackathon Dashboard
                              </Link>
                            </Button>
                            
                            {/* Action Buttons */}
                            {!userTeam ? (
                              <div className="flex flex-col gap-2">
                                <Button onClick={() => setShowTeamForm(hackathon.id)} className="w-full">
                                  <Users className="w-4 h-4 mr-2" />
                                  Create Team
                                </Button>
                                <Button variant="outline" onClick={() => {
                                  setSelectedHackathonForTeams(hackathon.id);
                                  void loadHackathonTeamsAndPlayers(hackathon.id);
                                  setShowJoinTeam(hackathon.id);
                                }} className="w-full">
                                  <Users className="w-4 h-4 mr-2" />
                                  Join Team
                                </Button>
                                <Button variant="outline" onClick={() => {
                                  setShowFindTeammates(hackathon.id);
                                  void loadHackathonRegisteredMembers(hackathon.id);
                                }} className="w-full">
                                  <Users className="w-4 h-4 mr-2" />
                                  Invite Someone
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div 
                                  className="p-4 bg-gradient-to-r from-red-900/40 to-amber-900/40 border border-red-700/50 rounded-lg cursor-pointer hover:from-red-900/60 hover:to-amber-900/60 transition-all duration-200"
                                  onClick={() => {
                                    setSelectedHackathonForTeams(hackathon.id);
                                    void loadHackathonTeamsAndPlayers(hackathon.id);
                                    setShowJoinTeam(hackathon.id);
                                  }}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="font-bold text-lg text-red-200 flex items-center gap-2">
                                      <Users className="w-5 h-5" />
                                      {userTeam.team_name}
                                    </p>
                                    <Badge variant="secondary" className="bg-red-800/50 text-red-200 border-red-700/50">
                                      {userTeam.members.length}/4
                                    </Badge>
                                  </div>
                                  <div className="space-y-1">
                                    {userTeam.members.map((m) => (
                                      <p key={m.member_id} className="text-sm text-red-100/80">
                                        {m.role === "leader" && "👑 "}{m.full_name}
                                      </p>
                                    ))}
                                  </div>
                                  <p className="text-xs text-red-300/60 mt-2 italic">Click to view team details</p>
                                </div>
                                {userTeam.members.length < 4 && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full border-red-700/50 text-red-200 hover:bg-red-900/40" 
                                    onClick={() => {
                                      setShowFindTeammates(hackathon.id);
                                      void loadHackathonRegisteredMembers(hackathon.id);
                                    }}
                                  >
                                    <Users className="w-4 h-4 mr-2" />
                                    Invite More Members
                                  </Button>
                                )}
                              </div>
                            )}

                            {/* View Teams & Players Button */}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full"
                              onClick={() => {
                                setSelectedHackathonForTeams(hackathon.id);
                                void loadHackathonTeamsAndPlayers(hackathon.id);
                                setShowJoinTeam(hackathon.id);
                              }}
                            >
                              View Teams & Players
                            </Button>
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
            <div className="space-y-6">
              {/* Profile Header Card - Beautiful and Priority-Based */}
              <Card className="relative overflow-hidden border-2 shadow-xl">
                <div className={`absolute inset-0 bg-gradient-to-br ${
                  (member.priority_level || 0) >= 90 
                    ? "from-yellow-500/20 via-amber-500/10 to-yellow-600/20" 
                    : (member.priority_level || 0) >= 50
                    ? "from-purple-500/20 via-pink-500/10 to-purple-600/20"
                    : member.verified_badge
                    ? "from-blue-500/20 via-cyan-500/10 to-blue-600/20"
                    : member.star_badge
                    ? "from-amber-500/20 via-yellow-500/10 to-amber-600/20"
                    : "from-primary/10 via-purple-500/5 to-primary/10"
                }`}></div>
                <CardHeader className="relative">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h2 className={`text-4xl font-bold ${
                          (member.priority_level || 0) >= 90 
                            ? "bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 bg-clip-text text-transparent" 
                            : (member.priority_level || 0) >= 50
                            ? "bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent"
                            : member.verified_badge
                            ? "bg-gradient-to-r from-blue-400 via-cyan-500 to-blue-600 bg-clip-text text-transparent"
                            : member.star_badge
                            ? "bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent"
                            : "text-foreground"
                        }`}>
                          {member.full_name}
                        </h2>
                        <div className="flex items-center gap-2">
                          <PremiumBadge 
                            verified={member.verified_badge} 
                            star={member.star_badge} 
                            custom={member.custom_badge} 
                            size="lg" 
                          />
                        </div>
                      </div>
                      {member.priority_level && member.priority_level > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={`${
                            member.priority_level >= 90 
                              ? "border-yellow-500/50 text-yellow-500 bg-yellow-500/10" 
                              : member.priority_level >= 50
                              ? "border-purple-500/50 text-purple-500 bg-purple-500/10"
                              : "border-primary/50 text-primary bg-primary/10"
                          }`}>
                            <Sparkles className="w-3 h-3 mr-1" />
                            Priority Level: {member.priority_level}
                          </Badge>
                          {member.member_category && member.member_category !== "regular" && (
                            <Badge variant="secondary" className="capitalize">
                              {member.member_category === "admin" && <Shield className="w-3 h-3 mr-1" />}
                              {member.member_category === "friend" && <Heart className="w-3 h-3 mr-1" />}
                              {member.member_category === "vip" && <Crown className="w-3 h-3 mr-1" />}
                              {member.member_category === "core_team" && <Users className="w-3 h-3 mr-1" />}
                              {member.member_category === "special" && <Award className="w-3 h-3 mr-1" />}
                              {member.member_category}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email Address</label>
                      <p className="text-base font-medium flex items-center gap-2">
                        {member.email}
                        {member.email_verified && (
                          <Badge variant="outline" className="text-xs border-green-500/50 text-green-500 bg-green-500/10">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Member Since</label>
                      <p className="text-base font-medium">{formatDate(member.created_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Profile Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Your ShadowMesh membership details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {member.cohort && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Cohort</label>
                    <p className="text-lg">{member.cohort}</p>
                  </div>
                )}
                    {member.area_of_interest && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Area of Interest</label>
                        <div className="mt-1">
                          <Badge variant="secondary" className="text-base px-3 py-1">
                            {member.area_of_interest === "AI" ? "AI / Machine Learning" :
                             member.area_of_interest === "Cyber" ? "Cybersecurity" :
                             member.area_of_interest === "Both" ? "Both (AI × Cyber)" :
                             member.area_of_interest}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                  {member.affiliation && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Affiliation</label>
                    <p className="text-lg capitalize">{member.affiliation}</p>
                  </div>
                )}
                {member.motivation && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Motivation</label>
                    <p className="text-sm text-muted-foreground leading-relaxed">{member.motivation}</p>
                  </div>
                )}
                {member.affiliation === "student" && (
                  <>
                    {member.university_name && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">University</label>
                        <p className="text-lg">{member.university_name}</p>
                      </div>
                    )}
                    {member.department && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Department</label>
                        <p className="text-lg">{member.department}</p>
                      </div>
                    )}
                    {member.roll_number && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Roll Number</label>
                        <p className="text-lg font-mono">{member.roll_number}</p>
                      </div>
                    )}
                  </>
                )}
                {(member.affiliation === "professional" || member.affiliation === "other") && (
                  <>
                    {member.organization && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Organization</label>
                        <p className="text-lg">{member.organization}</p>
                      </div>
                    )}
                    {member.role_title && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Role / Title</label>
                        <p className="text-lg">{member.role_title}</p>
                      </div>
                    )}
                  </>
                )}
                {member.phone_e164 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="text-lg">{member.phone_e164}</p>
                  </div>
                )}
                <div className="pt-4 border-t space-y-3">
                  {/* 2FA Section */}
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Two-Factor Authentication
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {member.two_factor_enabled 
                            ? "2FA is enabled. Your account is protected." 
                            : "Add an extra layer of security to your account."}
                        </p>
                      </div>
                      <Badge variant={member.two_factor_enabled ? "default" : "secondary"}>
                        {member.two_factor_enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    {!member.two_factor_enabled ? (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setShow2FASetup(true)}
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Enable 2FA
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDisable2FA()}
                      >
                        Disable 2FA
                      </Button>
                    )}
                  </div>
                  
                  <Button 
                    variant="default" 
                    className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                    onClick={() => setShowFeedback(true)}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Feedback
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => {
                    localStorage.removeItem("shadowmesh_member_email");
                    localStorage.removeItem("shadowmesh_authenticated");
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
            </div>
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
                paymentRequired={hackathons.find((h) => h.id === showHackathonReg)?.payment_required || false}
                feeAmount={hackathons.find((h) => h.id === showHackathonReg)?.fee_amount || 0}
                feeCurrency={hackathons.find((h) => h.id === showHackathonReg)?.fee_currency || "PKR"}
                onSuccess={() => {
                  setShowHackathonReg(null);
                  void loadMemberDataByEmail(localStorage.getItem("shadowmesh_member_email") || "");
                }}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* QR Code Dialog */}
        {showQRCode && member && (
          <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5" />
                  Your ShadowMesh Code
                </DialogTitle>
                <DialogDescription>
                  Scan this QR code to quickly access your member portal or share it for event check-ins.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center space-y-4 py-4">
                <div className="p-4 bg-white rounded-lg">
                  <QRCodeSVG
                    value={member.id || ""}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Your Member ID</p>
                  <p className="text-xs font-mono text-muted-foreground break-all">{member.id}</p>
                  <p className="text-xs text-muted-foreground">
                    Use this QR code for event attendance check-in.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowQRCode(false)}>Close</Button>
                <Button
                  onClick={() => {
                    if (member.id) {
                      navigator.clipboard.writeText(member.id);
                      toast({ title: "Copied!", description: "Member ID copied to clipboard." });
                    }
                  }}
                >
                  Copy Member ID
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* 2FA Setup Dialog */}
        {show2FASetup && (
          <Dialog open={show2FASetup} onOpenChange={setShow2FASetup}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Setup Two-Factor Authentication
                </DialogTitle>
                <DialogDescription>
                  Add an extra layer of security to your account using an authenticator app.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {!twoFactorQRCode ? (
                  <div className="text-center space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Click the button below to generate a QR code for your authenticator app.
                    </p>
                    <Button
                      onClick={handleSetup2FA}
                      disabled={twoFactorVerifying}
                      className="w-full"
                    >
                      {twoFactorVerifying ? "Generating..." : "Generate QR Code"}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="text-center space-y-4">
                      <p className="text-sm font-medium">Step 1: Scan QR Code</p>
                      <p className="text-xs text-muted-foreground">
                        Open your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.) and scan this QR code.
                      </p>
                      <div className="flex justify-center p-4 bg-white rounded-lg">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(twoFactorQRCode)}`}
                          alt="2FA QR Code"
                          className="w-48 h-48"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Or enter this code manually: <span className="font-mono font-bold">{twoFactorSecret}</span>
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Step 2: Enter Verification Code</p>
                      <Input
                        type="text"
                        maxLength={6}
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="text-center text-2xl font-mono tracking-widest"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter the 6-digit code from your authenticator app.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShow2FASetup(false);
                          setTwoFactorCode("");
                          setTwoFactorSecret(null);
                          setTwoFactorQRCode(null);
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleEnable2FA}
                        disabled={twoFactorCode.length !== 6 || twoFactorVerifying}
                        className="flex-1"
                      >
                        {twoFactorVerifying ? "Verifying..." : "Enable 2FA"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Find Teammates / Invite Dialog */}
        {showFindTeammates && member && (
          <Dialog open onOpenChange={() => {
            setShowFindTeammates(null);
            setHackathonRegisteredMembers([]);
            setRequestMessage("");
          }}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Invite Teammates</DialogTitle>
                <DialogDescription>
                  {showFindTeammates && hackathons.find(h => h.id === showFindTeammates) && (
                    <p>Find and invite approved members for: <strong>{hackathons.find(h => h.id === showFindTeammates)?.title}</strong></p>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {loadingHackathonMembers ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading registered members...</p>
                  </div>
                ) : hackathonRegisteredMembers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No available members to invite.</p>
                    <p className="text-sm text-muted-foreground mt-2">All approved members are already in teams or you need to create a team first.</p>
                    {!teams.find(t => t.hackathon_id === showFindTeammates) && (
                      <Button className="mt-4" onClick={() => {
                        setShowFindTeammates(null);
                        setShowTeamForm(showFindTeammates);
                      }}>
                        Create Team First
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-sm font-medium mb-2">Invitation Message (optional)</p>
                      <Textarea
                        value={requestMessage}
                        onChange={(e) => setRequestMessage(e.target.value)}
                        placeholder="Hi! I'd like to invite you to join my hackathon team..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Available Members ({hackathonRegisteredMembers.length})</p>
                      <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                        {hackathonRegisteredMembers.map((m: any) => {
                          const userTeam = teams.find(t => t.hackathon_id === showFindTeammates);
                          const hasPendingRequest = teamRequests.some(tr => 
                            tr.to_member_id === m.id && 
                            tr.team_id === userTeam?.id && 
                            tr.status === "pending"
                          );
                          
                          return (
                            <Card key={m.id} className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-medium">{m.full_name}</p>
                                  <p className="text-xs text-muted-foreground">{m.email}</p>
                                  {m.area_of_interest && (
                                    <Badge variant="outline" className="mt-1 text-xs">
                                      {m.area_of_interest}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  {userTeam ? (
                                    <Button
                                      size="sm"
                                      variant={hasPendingRequest ? "secondary" : "default"}
                                      disabled={hasPendingRequest || userTeam.members.length >= 4}
                                      onClick={() => {
                                        if (userTeam && !hasPendingRequest) {
                                          void sendTeamRequest(userTeam.id, m.id);
                                        }
                                      }}
                                    >
                                      {hasPendingRequest ? "Request Sent" : userTeam.members.length >= 4 ? "Team Full" : "Invite"}
                                    </Button>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">Create a team first</p>
                                  )}
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowFindTeammates(null);
                  setHackathonRegisteredMembers([]);
                  setRequestMessage("");
                }}>
                  Close
                </Button>
                {!teams.find(t => t.hackathon_id === showFindTeammates) && (
                  <Button onClick={() => {
                    setShowFindTeammates(null);
                    setShowTeamForm(showFindTeammates);
                  }}>
                    Create Team First
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Team Invite Dialog */}
        <Dialog
          open={inviteDialogOpen}
          onOpenChange={(open) => {
            setInviteDialogOpen(open);
            if (!open) setSelectedInvite(null);
          }}
        >
          <DialogContent className="max-w-md">
            {selectedInvite ? (
              <>
                <DialogHeader>
                  <DialogTitle>Join {selectedInvite.team_name}</DialogTitle>
                  <DialogDescription>
                    {selectedInvite.hackathon_title || "Hackathon team invitation"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">Leader</p>
                    <p className="font-semibold">{selectedInvite.leader_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedInvite.leader_email}</p>
                    {selectedInvite.leader_interest && (
                      <Badge variant="outline" className="mt-2">
                        {selectedInvite.leader_interest}
                      </Badge>
                    )}
                  </div>
                  {selectedInvite.message && (
                    <div className="rounded-lg border p-3 bg-muted/10">
                      <p className="text-sm text-muted-foreground mb-1">Message</p>
                      <p className="text-sm">{selectedInvite.message}</p>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Sent {new Date(selectedInvite.created_at).toLocaleString()}
                  </div>
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={respondingInvite}
                    onClick={() => void respondToInvite("rejected")}
                  >
                    {respondingInvite ? "Please wait..." : "Decline"}
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={respondingInvite}
                    onClick={() => void respondToInvite("accepted")}
                  >
                    {respondingInvite ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      "Accept Invite"
                    )}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="py-10 text-center text-muted-foreground text-sm">
                Select an invite to view details.
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Create Team Dialog */}
        {showTeamForm && member && (
          <Dialog open onOpenChange={() => {
            setShowTeamForm(null);
            setTeamName("");
            setTeamNameError(null);
          }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Team</DialogTitle>
                <DialogDescription>
                  {showTeamForm && hackathons.find(h => h.id === showTeamForm) && (
                    <p>Create a team for: <strong>{hackathons.find(h => h.id === showTeamForm)?.title}</strong></p>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Team Name <span className="text-destructive">*</span></label>
                  <Input
                    value={teamName}
                    onChange={(e) => {
                      setTeamName(e.target.value);
                      if (teamNameError) setTeamNameError(null);
                    }}
                    placeholder="Enter team name"
                    maxLength={50}
                  />
                  {teamNameError ? (
                    <p className="text-xs text-destructive mt-1">{teamNameError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Maximum 4 members per team</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowTeamForm(null);
                  setTeamName("");
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (showTeamForm) {
                      void createTeam(showTeamForm);
                    }
                  }}
                  disabled={!teamName.trim()}
                >
                  Create Team
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Join Team / View Teams & Players Dialog */}
        {showJoinTeam && member && selectedHackathonForTeams && (
          <Dialog open onOpenChange={() => {
            setShowJoinTeam(null);
            setSelectedHackathonForTeams(null);
            setHackathonTeams([]);
            setHackathonSinglePlayers([]);
          }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Teams & Players</DialogTitle>
                <DialogDescription>
                  {selectedHackathonForTeams && hackathons.find(h => h.id === selectedHackathonForTeams) && (
                    <p>View teams and single players for: <strong>{hackathons.find(h => h.id === selectedHackathonForTeams)?.title}</strong></p>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {loadingHackathonMembers ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading teams and players...</p>
                  </div>
                ) : (
                  <>
                    {/* Existing Teams */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Existing Teams ({hackathonTeams.length})
                      </h3>
                      {hackathonTeams.length === 0 ? (
                        <Card className="p-4">
                          <p className="text-sm text-muted-foreground text-center">No teams formed yet. Be the first to create one!</p>
                        </Card>
                      ) : (
                        <div className="grid gap-4">
                          {hackathonTeams.map((team: any) => {
                            const currentUserTeam = teams.find((t) => t.hackathon_id === selectedHackathonForTeams);
                            const isInTeam = currentUserTeam?.id === team.id;
                            const canJoin = !isInTeam && !currentUserTeam && team.members.length < (team.max_members || 4);
                            
                            return (
                              <Card key={team.id} className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <p className="font-semibold text-lg">{team.team_name}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {team.members.length}/{team.max_members || 4} members
                                    </p>
                                  </div>
                                  {isInTeam && (
                                    <Badge variant="secondary">Your Team</Badge>
                                  )}
                                  {canJoin && (
                                    <Button size="sm" onClick={() => {
                                      void joinTeam(team.id);
                                    }}>
                                      Join Team
                                    </Button>
                                  )}
                                </div>
                                <div className="space-y-2 mt-3 pt-3 border-t">
                                  <p className="text-xs font-medium text-muted-foreground">Members:</p>
                                  {team.members.map((m: any) => (
                                    <div key={m.member_id} className="flex items-center justify-between text-sm">
                                      <div className="flex-1">
                                        <p className="font-medium">
                                          {m.full_name} {m.role === "leader" && <Badge variant="outline" className="ml-2 text-xs">Leader</Badge>}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{m.email}</p>
                                        {m.area_of_interest && (
                                          <Badge variant="outline" className="mt-1 text-xs">
                                            {m.area_of_interest}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Single Players */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Single Players ({hackathonSinglePlayers.length})
                      </h3>
                      {hackathonSinglePlayers.length === 0 ? (
                        <Card className="p-4">
                          <p className="text-sm text-muted-foreground text-center">All approved members are in teams.</p>
                        </Card>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {hackathonSinglePlayers.map((player: any) => (
                            <Card key={player.id} className="p-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-medium">{player.full_name}</p>
                                  <p className="text-xs text-muted-foreground">{player.email}</p>
                                  {player.area_of_interest && (
                                    <Badge variant="outline" className="mt-1 text-xs">
                                      {player.area_of_interest}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowJoinTeam(null);
                  setSelectedHackathonForTeams(null);
                  setHackathonTeams([]);
                  setHackathonSinglePlayers([]);
                }}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Feedback Dialog */}
        {showFeedback && member && (
          <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Send Feedback
                </DialogTitle>
                <DialogDescription>
                  Share your thoughts, suggestions, or report issues. We value your feedback!
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Feedback Type</label>
                  <Select value={feedbackType} onValueChange={setFeedbackType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Feedback</SelectItem>
                      <SelectItem value="event">Event Feedback</SelectItem>
                      <SelectItem value="portal">Portal Feedback</SelectItem>
                      <SelectItem value="suggestion">Suggestion</SelectItem>
                      <SelectItem value="bug">Bug Report</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {feedbackType === "event" && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Related Event (optional)</label>
                    <Select value={feedbackEventId || ""} onValueChange={(v) => setFeedbackEventId(v || null)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an event" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {[...events, ...hackathons].map((event) => (
                          <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">Subject (optional)</label>
                  <Input
                    value={feedbackSubject}
                    onChange={(e) => setFeedbackSubject(e.target.value)}
                    placeholder="Brief subject line"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Rating (optional)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        className={`p-2 rounded transition-colors ${
                          feedbackRating && feedbackRating >= star
                            ? "text-yellow-400"
                            : "text-muted-foreground hover:text-yellow-300"
                        }`}
                      >
                        <Star className={`w-6 h-6 ${feedbackRating && feedbackRating >= star ? "fill-current" : ""}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Message <span className="text-destructive">*</span></label>
                  <Textarea
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder="Tell us what you think..."
                    rows={6}
                    className="resize-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowFeedback(false);
                  setFeedbackType("general");
                  setFeedbackSubject("");
                  setFeedbackMessage("");
                  setFeedbackRating(null);
                  setFeedbackEventId(null);
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={submitFeedback}
                  className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                  disabled={!feedbackMessage.trim()}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit Feedback
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Event Registration Dialog */}
        {showEventReg && member && events.find(e => e.id === showEventReg) && (
          <Dialog open onOpenChange={() => setShowEventReg(null)}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Register for Event</DialogTitle>
                <DialogDescription>
                  Complete the registration form below
                </DialogDescription>
              </DialogHeader>
              <EventRegistration
                eventId={showEventReg}
                eventTitle={events.find(e => e.id === showEventReg)?.title || ""}
                memberId={member.id}
                paymentRequired={events.find(e => e.id === showEventReg)?.payment_required || false}
                feeAmount={events.find(e => e.id === showEventReg)?.fee_amount || 0}
                feeCurrency={events.find(e => e.id === showEventReg)?.fee_currency || "PKR"}
                onSuccess={() => handleEventRegistrationSuccess(showEventReg)}
                onCancel={() => setShowEventReg(null)}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* Announcement Detail Dialog */}
        <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5" />
                {selectedAnnouncement?.title}
              </DialogTitle>
              <DialogDescription>
                {selectedAnnouncement?.description}
              </DialogDescription>
            </DialogHeader>
            {selectedAnnouncement?.link && (
              <div className="py-4">
                <Button className="w-full" asChild>
                  <a href={selectedAnnouncement.link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Link
                  </a>
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedAnnouncement(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

