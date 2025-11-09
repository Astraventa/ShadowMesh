import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Calendar, BookOpen, ExternalLink, Download, Video, Link as LinkIcon, FileText, Users, Trophy, Activity, Send, KeyRound, QrCode, Star, MessageSquare, ChevronRight, ChevronDown } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import HackathonRegistration from "@/components/HackathonRegistration";
import EventRegistration from "@/components/EventRegistration";
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
  const [requestMessage, setRequestMessage] = useState("");
  const [showQRCode, setShowQRCode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginCode, setLoginCode] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
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
    const storedCode = localStorage.getItem("shadowmesh_member_token");
    
    if (authenticated === "true" && storedCode) {
      // User is authenticated, load data
      loadMemberData(storedCode);
    } else {
      // Show login screen
      setShowLogin(true);
      setLoading(false);
      
      // Pre-fill code from URL if present
      const params = new URLSearchParams(window.location.search);
      const tokenParam = params.get("code") || params.get("token");
      if (tokenParam) {
        setLoginCode(tokenParam.trim().toUpperCase());
      } else if (storedCode) {
        setLoginCode(storedCode);
      }
    }
  }, []);

  async function loadMemberData(token: string) {
    setLoading(true);
    try {
      // Verify token and get member info
      if (!token || typeof token !== 'string') {
        throw new Error("Invalid token provided");
      }
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

      // SECURITY: Verify that the code matches the member's secret_code
      const providedCode = (verifyData.secret_code || token).toUpperCase();
      const memberSecretCode = memberData.secret_code?.toUpperCase();
      
      if (memberSecretCode && providedCode !== memberSecretCode) {
        throw new Error("Invalid access code. This code does not match your account.");
      }

      setMember(memberData);
      const storedCode = providedCode;
      localStorage.setItem("shadowmesh_member_token", storedCode);
      localStorage.setItem("shadowmesh_authenticated", "true");

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

  async function handleEventRegistrationSuccess(eventId?: string) {
    if (eventId) {
      setRegisteredEvents((prev) => new Set([...prev, eventId]));
    }
    setShowEventReg(null);
    // Reload member data to refresh registrations
    const token = localStorage.getItem("shadowmesh_member_token");
    if (token) {
      await loadMemberData(token);
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

  async function loadHackathonTeamsAndPlayers(hackathonId: string) {
    if (!member) return;
    setLoadingHackathonMembers(true);
    try {
      // Get all approved registrations for this hackathon
      const { data: approvedRegs, error: regError } = await supabase
        .from("hackathon_registrations")
        .select("member_id, members(id, full_name, email, area_of_interest, secret_code)")
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
            members(id, full_name, email, area_of_interest, secret_code)
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
            secret_code: tm.members?.secret_code || "",
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
          secret_code: r.members?.secret_code || "",
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
      void loadMemberData(localStorage.getItem("shadowmesh_member_token") || "");
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
        .select("member_id, members(id, full_name, email, area_of_interest, secret_code)")
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
      void loadMemberData(localStorage.getItem("shadowmesh_member_token") || "");
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
      void loadMemberData(localStorage.getItem("shadowmesh_member_token") || "");
    } catch (e: any) {
      toast({ title: "Failed to respond", description: e.message });
    }
  }

  async function handleLogin() {
    if (!loginCode.trim()) {
      toast({ title: "Code required", description: "Please enter your ShadowMesh code." });
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
      
      // First verify the code
      const verifyRes = await fetch(`${SUPABASE_URL}/functions/v1/verify`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ code: loginCode.trim().toUpperCase() }),
      });

      if (!verifyRes.ok) {
        throw new Error("Invalid code. Please check your ShadowMesh code.");
      }

      const verifyData = await verifyRes.json();
      if (verifyData.status !== "approved") {
        throw new Error("Your application is not approved yet.");
      }

      // Get member by secret_code
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("*")
        .eq("secret_code", loginCode.trim().toUpperCase())
        .single();

      if (memberError || !memberData) {
        throw new Error("Member not found. Please ensure your application has been approved.");
      }

      // Check if password is set
      if (!memberData.password_hash) {
        // First time login - require password setup
        if (!newPassword || !confirmPassword) {
          setIsSettingPassword(true);
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
        // Use member's secret_code for consistent salt generation
        const passwordHash = await hashPassword(newPassword, memberData.secret_code || memberData.id);
        
        // Update member with password
        const { error: updateError } = await supabase
          .from("members")
          .update({ password_hash: passwordHash })
          .eq("id", memberData.id);

        if (updateError) throw updateError;
        
        toast({ title: "Password set!", description: "Your password has been set successfully." });
        setIsSettingPassword(false);
        setNewPassword("");
        setConfirmPassword("");
      } else {
        // Password is set - verify it
        if (!loginPassword) {
          toast({ title: "Password required", description: "Please enter your password." });
          return;
        }

        // Verify password using member's secret_code for consistent salt
        const isValid = await verifyPassword(loginPassword, memberData.password_hash, memberData.secret_code || memberData.id);
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
        
        // Successful login - reset failed attempts
        setFailedAttempts(0);
        setIsLocked(false);
        setLockUntil(null);
        setShowForgotPassword(false);
      }

      // Authentication successful
      setMember(memberData);
      localStorage.setItem("shadowmesh_member_token", loginCode.trim().toUpperCase());
      localStorage.setItem("shadowmesh_authenticated", "true");
      setShowLogin(false);
      setLoginPassword("");
      setLoginCode("");
      setFailedAttempts(0);
      setIsLocked(false);
      setLockUntil(null);
      setShowForgotPassword(false);
      
      // Load member data
      await loadMemberData(loginCode.trim().toUpperCase());
    } catch (e: any) {
      toast({ title: "Login failed", description: e.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function hashPassword(password: string, memberIdOrCode: string): Promise<string> {
    // Enhanced password hashing with PBKDF2 for better security
    // Using PBKDF2 with 100,000 iterations to resist brute force attacks
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    
    // Generate salt from member ID or code (deterministic but unique per user)
    // Use memberIdOrCode to ensure consistent salt generation
    const saltData = encoder.encode((memberIdOrCode || loginCode || "").trim().toUpperCase() + "shadowmesh_salt");
    
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

  async function verifyPassword(password: string, hash: string, memberIdOrCode: string): Promise<boolean> {
    const passwordHash = await hashPassword(password, memberIdOrCode);
    return passwordHash === hash;
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
            <CardTitle className="text-2xl text-center">ShadowMesh Portal</CardTitle>
            <CardDescription className="text-center">
              Enter your code and password to access your member dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">ShadowMesh Code</label>
              <Input
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
                placeholder="SMXXXXXX"
                className="font-mono text-center text-lg"
                disabled={loading}
              />
            </div>
            
            {isSettingPassword ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Set Password (min 8 characters, must include uppercase, lowercase, numbers, and special characters)</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Confirm Password</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    disabled={loading}
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <Input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleLogin();
                    }
                  }}
                />
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
                  const isNew = new Date(hackathon.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000);
                  const isExpanded = expandedHackathons.has(hackathon.id);

                  return (
                    <Card 
                      key={hackathon.id} 
                      className="bg-gradient-to-br from-red-950/90 via-red-900/80 to-amber-950/90 backdrop-blur-sm border-red-800/50 hover:border-red-600/70 transition-all duration-300 hover:shadow-lg hover:shadow-red-600/20 relative overflow-hidden"
                    >
                      {/* Fire Animation */}
                      <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-60">
                        <div className="fire-animation"></div>
                      </div>
                      {isNew && (
                        <div className="absolute top-2 right-2 z-10">
                          <Badge variant="destructive">NEW</Badge>
                        </div>
                      )}
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <CardTitle className="text-2xl font-bold mb-2 flex items-center gap-2 text-red-100">
                              <Trophy className="w-6 h-6 text-amber-400" />
                              {hackathon.title}
                            </CardTitle>
                            <div className="flex items-center gap-2 flex-wrap text-red-100/80">
                              <Badge variant="outline" className="bg-red-800/30 border-red-600/50 text-red-200">
                                Hackathon
                              </Badge>
                              <span className="text-sm">•</span>
                              <Badge variant="secondary" className="text-xs bg-amber-800/30 text-amber-200 border-amber-600/50">Upcoming</Badge>
                              <span className="text-sm">•</span>
                              <span className="text-sm">{formatDate(hackathon.start_date)}</span>
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
                        {hackathon.description && !isExpanded && (
                          <p className="text-sm text-red-100/80 leading-relaxed line-clamp-2">{hackathon.description}</p>
                        )}
                        {isExpanded && (
                          <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                            {hackathon.description && (
                              <div>
                                <p className="text-sm font-medium mb-1">Description</p>
                                <p className="text-sm text-muted-foreground leading-relaxed">{hackathon.description}</p>
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
                              {hackathon.location && (
                                <div className="col-span-2">
                                  <p className="text-muted-foreground mb-1">📍 Location</p>
                                  <p>{hackathon.location}</p>
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
                              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-600/90 hover:to-purple-800/90"
                              onClick={() => setShowHackathonReg(hackathon.id)}
                            >
                              Register for Hackathon
                            </Button>
                          ) : null}
                        </div>
                        
                        {!reg ? (
                          <div className="mt-2">
                            {hackathon.payment_required ? (
                              <p className="text-sm text-muted-foreground">This hackathon requires payment and registration.</p>
                            ) : (
                              <p className="text-sm text-muted-foreground">Register to participate in this hackathon.</p>
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
                {member.area_of_interest && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Area of Interest</label>
                    <p className="text-lg">
                      <Badge variant="secondary" className="text-base">
                        {member.area_of_interest === "AI" ? "AI / Machine Learning" :
                         member.area_of_interest === "Cyber" ? "Cybersecurity" :
                         member.area_of_interest === "Both" ? "Both (AI × Cyber)" :
                         member.area_of_interest}
                      </Badge>
                    </p>
                  </div>
                )}
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
                  <Button 
                    variant="default" 
                    className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                    onClick={() => setShowFeedback(true)}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Feedback
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => {
                    localStorage.removeItem("shadowmesh_member_token");
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
                  void loadMemberData(localStorage.getItem("shadowmesh_member_token") || "");
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
                    value={member.secret_code || ""}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Your Code</p>
                  <p className="text-2xl font-mono font-bold">{member.secret_code}</p>
                  <p className="text-xs text-muted-foreground">
                    Keep this code secure. Use it for event registration and attendance.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowQRCode(false)}>Close</Button>
                <Button
                  onClick={() => {
                    if (member.secret_code) {
                      navigator.clipboard.writeText(member.secret_code);
                      toast({ title: "Copied!", description: "Code copied to clipboard." });
                    }
                  }}
                >
                  Copy Code
                </Button>
              </DialogFooter>
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

        {/* Create Team Dialog */}
        {showTeamForm && member && (
          <Dialog open onOpenChange={() => {
            setShowTeamForm(null);
            setTeamName("");
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
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter team name"
                    maxLength={50}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Maximum 4 members per team</p>
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
                                      <p className="text-xs font-mono text-muted-foreground ml-2">{m.secret_code}</p>
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
                                <p className="text-xs font-mono text-muted-foreground ml-2">{player.secret_code}</p>
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
      </div>
    </div>
  );
}

