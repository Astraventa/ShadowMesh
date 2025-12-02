import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { RealtimeChannel } from "@supabase/supabase-js";
import PremiumBadge from "@/components/PremiumBadge";
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
  Bell,
  Check,
  Trash2,
  Search,
  Loader2,
  X,
  Send,
  User,
  Copy,
  Check,
  Mail,
  Trash2
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import HackathonRegistration from "@/components/HackathonRegistration";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseClient";

const CHAT_HISTORY_LIMIT = 150;

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
  members: Array<{ member_id: string; full_name: string; email: string; role: string; area_of_interest?: string; verified_badge?: boolean; star_badge?: boolean; custom_badge?: string }>;
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

interface TeamMessage {
  id: string;
  created_at: string;
  team_id: string;
  hackathon_id: string;
  sender_member_id: string;
  sender_name: string;
  sender_email: string;
  message: string;
  sender_verified_badge?: boolean;
  sender_star_badge?: boolean;
  sender_custom_badge?: string;
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
  const [inviteLinks, setInviteLinks] = useState<any[]>([]);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [chatMessages, setChatMessages] = useState<TeamMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [teamNameError, setTeamNameError] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<any | null>(null);
  const [respondingInvite, setRespondingInvite] = useState(false);
  const [invitingPlayerId, setInvitingPlayerId] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<Map<string, string>>(new Map()); // teamId -> requestId

  const chatChannelRef = useRef<RealtimeChannel | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingMessagesRef = useRef<Set<string>>(new Set()); // Track messages we're waiting for via realtime

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
        // Preload notifications
        await loadNotifications(memberData.id);

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
          const foundTeamId = await loadMemberTeam(hackathonId, memberData.id);

          // Load all teams and single players
          await loadTeamsAndPlayers(hackathonId, memberData.id);

          // Load submission
          const { data: subData } = await supabase
            .from("hackathon_submissions")
            .select("*")
            .eq("hackathon_id", hackathonId)
            .or(`member_id.eq.${memberData.id}${foundTeamId ? `,team_id.eq.${foundTeamId}` : ""}`)
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

  useEffect(() => {
    if (!team || !memberId) {
      chatChannelRef.current?.unsubscribe();
      chatChannelRef.current = null;
      setChatMessages([]);
      setChatInput("");
      return;
    }

    void loadTeamChat(team.id);

    // Use postgres_changes for reliable real-time updates (like WhatsApp)
    const channel = supabase
      .channel(`team-chat-${team.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_messages",
          filter: `team_id=eq.${team.id}`,
        },
        async (payload) => {
          const newMessage = payload.new as any;
          // Fetch sender info for the new message
          try {
            const { data: senderData } = await supabase
              .from("members")
              .select("full_name, email, verified_badge, star_badge, custom_badge")
              .eq("id", newMessage.sender_member_id)
              .single();

            const formattedMessage: TeamMessage = {
              id: newMessage.id,
              created_at: newMessage.created_at,
              team_id: newMessage.team_id,
              hackathon_id: newMessage.hackathon_id,
              sender_member_id: newMessage.sender_member_id,
              message: newMessage.message,
              sender_name: senderData?.full_name || "Unknown",
              sender_email: senderData?.email || "",
              sender_verified_badge: senderData?.verified_badge || false,
              sender_star_badge: senderData?.star_badge || false,
              sender_custom_badge: senderData?.custom_badge || null,
            };

            // Replace optimistic message or append new one
            setChatMessages((prev) => {
              // Remove any optimistic messages (temp IDs) from the same sender
              const filtered = prev.filter(
                (m) => !(m.id.startsWith("temp-") && m.sender_member_id === formattedMessage.sender_member_id)
              );
              
              // Check if message already exists
              const exists = filtered.some((m) => m.id === formattedMessage.id);
              if (exists) return filtered;
              
              // Mark this message as delivered (clear from pending)
              pendingMessagesRef.current.delete(formattedMessage.message);
              
              // Add the real message
              const updated = [...filtered, formattedMessage].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              return updated;
            });
            scrollChatToBottom();
          } catch (error) {
            console.error("Error processing realtime message:", error);
          }
        }
      )
      .subscribe();

    chatChannelRef.current = channel;

    return () => {
      channel.unsubscribe();
      chatChannelRef.current = null;
    };
  }, [team?.id, memberId]);

  // Real-time notifications subscription
  useEffect(() => {
    if (!memberId) return;

    // Load initial notifications
    void loadNotifications(memberId);

    // Subscribe to new notifications
    const notificationChannel = supabase
      .channel(`member-notifications-${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "member_notifications",
          filter: `member_id=eq.${memberId}`,
        },
        (payload) => {
          const newNotif = payload.new as any;
          // Reload notifications to get full data including synthetic team requests
          void loadNotifications(memberId);
          // Show toast for new notification
          if (newNotif.notification_type === "team_chat") {
            toast({
              title: newNotif.title || "New message",
              description: newNotif.message || "You have a new team chat message",
            });
          } else if (newNotif.notification_type === "team_invite" || newNotif.notification_type === "team_request") {
            toast({
              title: newNotif.title || "Team Invitation",
              description: newNotif.message || "You have a new team invitation",
            });
          } else {
            toast({
              title: newNotif.title || "New notification",
              description: newNotif.message || "You have a new notification",
            });
          }
        }
      )
      .subscribe();

    // Subscribe to team_requests changes
    const teamRequestChannel = supabase
      .channel(`team-requests-${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_requests",
          filter: `to_member_id=eq.${memberId}`,
        },
        () => {
          // Reload notifications to include new team request
          void loadNotifications(memberId);
        }
      )
      .subscribe();

    return () => {
      notificationChannel.unsubscribe();
      teamRequestChannel.unsubscribe();
    };
  }, [memberId, toast]);

  useEffect(() => {
    if (!team) return;
    scrollChatToBottom();
  }, [chatMessages, team]);

  async function loadPendingTeamRequests(currentMemberId: string) {
    try {
      // Load requests sent TO current member (they're the leader receiving join requests)
      // AND requests sent FROM current member (they're requesting to join teams)
      const { data: teamReqs } = await supabase
        .from("team_requests")
        .select("id, created_at, team_id, status, message, from_member_id, to_member_id")
        .or(`to_member_id.eq.${currentMemberId},from_member_id.eq.${currentMemberId}`)
        .eq("status", "pending");

      if (!teamReqs || teamReqs.length === 0) {
        return [];
      }

      const teamIds = Array.from(new Set(teamReqs.map((r: any) => r.team_id).filter(Boolean)));
      const requesterIds = Array.from(new Set(teamReqs.map((r: any) => r.from_member_id).filter(Boolean)));
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

      // Load requester info (members who want to join)
      const { data: requesters } = requesterIds.length
        ? await supabase
            .from("members")
            .select("id, full_name, email, area_of_interest")
            .in("id", Array.from(requesterIds))
        : { data: [] as any[] };
      const requesterMap = new Map<string, any>();
      (requesters || []).forEach((requester: any) => requesterMap.set(requester.id, requester));

      const { data: hackathons } = hackathonIds.size
        ? await supabase
            .from("events")
            .select("id, title")
            .in("id", Array.from(hackathonIds))
        : { data: [] as any[] };
      const hackathonMap = new Map<string, any>();
      (hackathons || []).forEach((eventRow: any) => hackathonMap.set(eventRow.id, eventRow));

      const requests = teamReqs.map((request: any) => {
        const teamRow = teamMap.get(request.team_id);
        const leaderRow = teamRow ? leaderMap.get(teamRow.team_leader_id) : null;
        const requesterRow = requesterMap.get(request.from_member_id);
        const hackathonRow = teamRow ? hackathonMap.get(teamRow.hackathon_id) : null;
        const isIncoming = request.to_member_id === currentMemberId; // Leader receiving request
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
          requester_id: request.from_member_id,
          requester_name: requesterRow?.full_name || "Member",
          requester_email: requesterRow?.email || "",
          requester_interest: requesterRow?.area_of_interest || "",
          is_incoming: isIncoming, // true if leader receiving, false if member sent request
          max_members: teamRow?.max_members || 4,
        };
      });

      // Update pending requests map for join button status
      const newPendingMap = new Map<string, string>();
      requests
        .filter((r) => !r.is_incoming) // Only requests sent by current member
        .forEach((r) => {
          newPendingMap.set(r.team_id, r.id);
        });
      setPendingRequests(newPendingMap);

      return requests;
    } catch (error) {
      console.error("Failed to load pending team requests:", error);
      return [];
    }
  }

  async function loadNotifications(currentMemberId: string) {
    try {
      // Load pending team requests first to update button states
      await loadPendingTeamRequests(currentMemberId);
      
      // member_notifications table (admin-triggered updates)
      const { data: notifRows, error } = await supabase
        .from("member_notifications")
        .select("*")
        .eq("member_id", currentMemberId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        console.error("Notifications load error:", error);
      }
      // pending team requests to this member
      const pendingInvites = await loadPendingTeamRequests(currentMemberId);
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
    } catch (e) {
      console.error("Failed loading notifications:", e);
    }
  }

  async function markAllRead() {
    try {
      if (!memberId) return;
      const now = new Date().toISOString();
      await supabase
        .from("member_notifications")
        .update({ is_read: true, read_at: now })
        .eq("member_id", memberId)
        .eq("is_read", false);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: now })));
      setUnreadCount(0);
    } catch {
      // non-fatal
    }
  }

  async function markNotificationRead(notificationId: string) {
    if (!memberId) return;
    try {
      const now = new Date().toISOString();
      await supabase
        .from("member_notifications")
        .update({ is_read: true, read_at: now })
        .eq("id", notificationId)
        .eq("member_id", memberId);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: now } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }

  async function deleteNotification(notificationId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!memberId) return;
    try {
      await supabase
        .from("member_notifications")
        .delete()
        .eq("id", notificationId)
        .eq("member_id", memberId);
      setNotifications(prev => {
        const filtered = prev.filter(n => n.id !== notificationId);
        setUnreadCount(filtered.filter(n => !n.is_read).length);
        return filtered;
      });
      toast({ title: "Notification deleted", description: "The notification has been removed." });
    } catch (error: any) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    }
  }

  function handleNotificationClick(notification: any) {
    if (notification?.source === "team_request" && notification.invite) {
      setSelectedInvite(notification.invite);
      setInviteDialogOpen(true);
      return;
    }
    if (notification?.action_url) {
      navigate(notification.action_url);
    } else if (notification?.related_type === "team" && notification.related_id && hackathonId) {
      navigate(`/hackathons/${hackathonId}?tab=teams`);
    }
  }

  async function respondToInvite(decision: "accepted" | "rejected") {
    if (!selectedInvite || !memberId) return;
    
    const isLeaderResponding = selectedInvite.is_incoming; // Leader responding to join request
    const requesterId = selectedInvite.requester_id;
    
    if (isLeaderResponding) {
      // Leader accepting/rejecting a join request
      if (decision === "accepted" && hasTeam && team?.id !== selectedInvite.team_id) {
        toast({ title: "Already in a team", description: "You can only be in one team per hackathon.", variant: "destructive" });
        return;
      }
    } else {
      // Member accepting/rejecting an invitation
      if (decision === "accepted" && hasTeam) {
        toast({ title: "Already in a team", description: "Leave your current team before accepting another invite.", variant: "destructive" });
        return;
      }
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

        // Add the appropriate member to the team
        const memberToAdd = isLeaderResponding ? requesterId : memberId;
        
        // Check if member is already in another team for this hackathon
        if (hackathonId) {
          const { data: existingTeams } = await supabase
            .from("team_members")
            .select("team_id, hackathon_teams!inner(hackathon_id)")
            .eq("member_id", memberToAdd);
          
          const inOtherTeam = existingTeams?.some((tm: any) => 
            tm.hackathon_teams?.hackathon_id === hackathonId && tm.team_id !== selectedInvite.team_id
          );
          
          if (inOtherTeam) {
            throw new Error("Member is already in another team for this hackathon.");
          }
        }

        await supabase
          .from("team_members")
          .insert({
            team_id: selectedInvite.team_id,
            member_id: memberToAdd,
            role: "member",
          });

        await supabase
          .from("team_requests")
          .update({ status: "accepted", responded_at: nowIso })
          .eq("id", selectedInvite.id);

        // Elite approach: Auto-reject all other pending requests from this member to other teams
        // This ensures first acceptance wins, others are automatically cancelled
        if (hackathonId) {
          const { data: otherRequests } = await supabase
            .from("team_requests")
            .select("id, team_id, hackathon_teams!inner(hackathon_id)")
            .eq("from_member_id", memberToAdd)
            .eq("status", "pending")
            .neq("id", selectedInvite.id);
          
          if (otherRequests && otherRequests.length > 0) {
            const sameHackathonRequests = otherRequests.filter((r: any) => 
              r.hackathon_teams?.hackathon_id === hackathonId
            );
            
            if (sameHackathonRequests.length > 0) {
              const otherRequestIds = sameHackathonRequests.map((r: any) => r.id);
              await supabase
                .from("team_requests")
                .update({ status: "rejected", responded_at: nowIso })
                .in("id", otherRequestIds);
              
              // Notify other team leaders that the member joined another team
              for (const req of sameHackathonRequests) {
                const { data: teamData } = await supabase
                  .from("hackathon_teams")
                  .select("team_leader_id, team_name")
                  .eq("id", req.team_id)
                  .single();
                
                if (teamData?.team_leader_id) {
                  await supabase
                    .from("member_notifications")
                    .insert({
                      member_id: teamData.team_leader_id,
                      notification_type: "general",
                      title: "Join Request Cancelled",
                      message: `${selectedInvite.is_incoming ? selectedInvite.requester_name : "A member"} joined another team. Their request to join "${teamData.team_name}" has been automatically cancelled.`,
                      related_id: req.team_id,
                      related_type: "team",
                    });
                }
              }
            }
          }
        }

        // Send notification to the requester if leader accepted
        if (isLeaderResponding && requesterId) {
          await supabase
            .from("member_notifications")
            .insert({
              member_id: requesterId,
              notification_type: "team_joined",
              title: `Join Request Accepted`,
              message: `Your request to join "${selectedInvite.team_name}" has been accepted!`,
              related_id: selectedInvite.team_id,
              related_type: "team",
              action_url: `/hackathons/${selectedInvite.hackathon_id}?tab=teams`,
            });
        }

        toast({ 
          title: isLeaderResponding ? "Request accepted" : "Invite accepted", 
          description: isLeaderResponding 
            ? `${selectedInvite.requester_name} has been added to your team.`
            : `You're now part of ${selectedInvite.team_name}.` 
        });
        setInviteDialogOpen(false);
        setSelectedInvite(null);
        await loadNotifications(memberId);
        if (hackathonId) {
          await loadMemberTeam(hackathonId, memberId);
          await loadTeamsAndPlayers(hackathonId, memberId);
        }
      } else {
        await supabase
          .from("team_requests")
          .update({ status: "rejected", responded_at: nowIso })
          .eq("id", selectedInvite.id);

        // Send notification to requester if leader rejected
        if (isLeaderResponding && requesterId) {
          await supabase
            .from("member_notifications")
            .insert({
              member_id: requesterId,
              notification_type: "general",
              title: `Join Request Declined`,
              message: `Your request to join "${selectedInvite.team_name}" was declined.`,
              related_id: selectedInvite.team_id,
              related_type: "team",
            });
        }

        toast({ 
          title: isLeaderResponding ? "Request declined" : "Invite declined", 
          description: isLeaderResponding 
            ? "The requester has been notified."
            : "The team has been notified." 
        });
        setInviteDialogOpen(false);
        setSelectedInvite(null);
        if (memberId) {
          await loadNotifications(memberId);
        }
      }
    } catch (error: any) {
      toast({ title: "Unable to process request", description: error.message, variant: "destructive" });
    } finally {
      setRespondingInvite(false);
    }
  }

  async function loadMemberTeam(hackathonId: string, currentMemberId: string): Promise<string | null> {
    // 1) Try as leader
    const { data: leaderTeam } = await supabase
      .from("hackathon_teams")
      .select(`
        *,
        team_members(
          member_id,
          role,
          members(id, full_name, email, verified_badge, star_badge, custom_badge)
        )
      `)
      .eq("hackathon_id", hackathonId)
      .eq("team_leader_id", currentMemberId)
      .maybeSingle();

    let teamId: string | null = leaderTeam?.id || null;

    // 2) If not leader, find membership
    if (!teamId) {
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id, hackathon_teams!inner(id, hackathon_id)")
        .eq("member_id", currentMemberId)
        .eq("hackathon_teams.hackathon_id", hackathonId)
        .limit(1);
      if (membership && membership.length > 0) {
        teamId = membership[0].team_id;
      }
    }

    if (teamId) {
      const { data: fullTeam } = await supabase
        .from("hackathon_teams")
        .select(`
          *,
          team_members(
            member_id,
            role,
            members(id, full_name, email, area_of_interest, verified_badge, star_badge, custom_badge)
          )
        `)
        .eq("id", teamId)
        .maybeSingle();
      if (fullTeam) {
        const formattedTeam = {
          ...fullTeam,
          members: (fullTeam.team_members || []).map((tm: any) => ({
            member_id: tm.member_id,
            full_name: tm.members?.full_name || "",
            email: tm.members?.email || "",
            role: tm.role,
            area_of_interest: tm.members?.area_of_interest || "",
            verified_badge: tm.members?.verified_badge || false,
            star_badge: tm.members?.star_badge || false,
            custom_badge: tm.members?.custom_badge || null
          }))
        };
        setTeam(formattedTeam as Team);
        if (fullTeam.team_leader_id === currentMemberId) {
          await loadInviteLinks(fullTeam.id);
        }
      }
    } else {
      setTeam(null);
    }
    return teamId;
  }

  async function loadInviteLinks(teamId: string) {
    try {
      if (!teamId || !memberId) {
        setInviteLinks([]);
        return;
      }

      // Use edge function to load invite links (bypasses RLS issues)
      const response = await fetch(`${SUPABASE_URL}/functions/v1/load_invite_links?team_id=${teamId}&member_id=${memberId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setInviteLinks(result.invites || []);
      } else {
        // Fallback to direct query if edge function fails
        const { data, error } = await supabase
          .from("hackathon_invites")
          .select("*")
          .eq("team_id", teamId)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error loading invite links:", error);
          setInviteLinks([]);
        } else {
          setInviteLinks(data || []);
        }
      }
    } catch (error: any) {
      console.error("Error loading invite links:", error);
      setInviteLinks([]);
    }
  }

  function appendChatMessage(message: TeamMessage) {
    setChatMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) {
        return prev;
      }
      const next = [...prev, message].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      if (next.length > CHAT_HISTORY_LIMIT) {
        return next.slice(next.length - CHAT_HISTORY_LIMIT);
      }
      return next;
    });
  }

  function scrollChatToBottom() {
    requestAnimationFrame(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    });
  }

  async function loadTeamChat(teamId: string) {
    if (!memberId) return;
    setChatLoading(true);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/team_chat_messages?team_id=${teamId}&member_id=${memberId}&limit=${CHAT_HISTORY_LIMIT}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to load messages");
      }
      setChatMessages(result.messages || []);
    } catch (error: any) {
      console.error("Error loading chat messages:", error);
      toast({ title: "Unable to load chat", description: error.message, variant: "destructive" });
    } finally {
      setChatLoading(false);
      scrollChatToBottom();
    }
  }

  async function handleSendChatMessage() {
    if (!team || !memberId) return;
    const message = chatInput.trim();
    if (!message || sendingChat) return;

    // Optimistic UI: Show message immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: TeamMessage = {
      id: tempId,
      created_at: new Date().toISOString(),
      team_id: team.id,
      hackathon_id: team.hackathon_id || "",
      sender_member_id: memberId,
      message: message,
      sender_name: "You",
      sender_email: "",
    };

    setChatInput("");
    appendChatMessage(optimisticMessage);
    scrollChatToBottom();
    setSendingChat(true);

    // Track this message as pending (waiting for realtime delivery)
    pendingMessagesRef.current.add(message);

    let responseOk = false;

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/team_chat_send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          team_id: team.id,
          member_id: memberId,
          message,
        }),
      });

      responseOk = response.ok;

      // If response is OK, message was saved - realtime will deliver it instantly
      if (response.ok) {
        // Message saved successfully - realtime handles delivery to all users
        // Keep optimistic message, realtime will replace it with real one
        // Input is already cleared, no error shown
        // Clear from pending after a delay (realtime should deliver it quickly)
        setTimeout(() => {
          pendingMessagesRef.current.delete(message);
        }, 3000);
        return;
      }

      // Response is not OK - message might have failed to send
      // But wait for realtime to confirm before showing error
      // Read response text first (can only read once)
      let errorMessage = "Failed to send message";
      try {
        const responseText = await response.text();
        if (responseText) {
          try {
            const errorJson = JSON.parse(responseText);
            errorMessage = errorJson.error || errorJson.message || errorMessage;
          } catch {
            errorMessage = responseText.slice(0, 100) || errorMessage;
          }
        }
      } catch (e) {
        // Ignore errors reading response
      }
      
      // Wait a bit to see if realtime delivered it anyway
      setTimeout(() => {
        // Check if realtime delivered it
        if (!pendingMessagesRef.current.has(message)) {
          // Message was delivered via realtime - don't show error
          return;
        }
        
        // Message wasn't delivered - it failed
        pendingMessagesRef.current.delete(message);
        setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
        setChatInput(message);
        toast({ title: "Failed to send message", description: errorMessage, variant: "destructive" });
      }, 2000); // Wait 2 seconds for realtime to deliver
      
    } catch (error: any) {
      // Network error or other exception
      // Wait to see if realtime delivered the message anyway
      setTimeout(() => {
        if (!pendingMessagesRef.current.has(message)) {
          // Message was delivered via realtime - don't show error
          return;
        }
        
        // Message wasn't delivered - it failed
        pendingMessagesRef.current.delete(message);
        setChatInput(message);
        setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast({ title: "Failed to send message", description: error.message || "Network error. Please try again.", variant: "destructive" });
      }, 2000); // Wait 2 seconds for realtime to deliver
    } finally {
      setSendingChat(false);
    }
  }

  function handleChatInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendChatMessage();
    }
  }

  async function notifyTeamDeletion(teamId: string, leaderId: string) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/team_notify_deletion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ team_id: teamId, actor_id: leaderId }),
      });
    } catch (error) {
      console.error("Failed to notify team deletion:", error);
    }
  }

  async function deleteTeam() {
    if (!team || !memberId) return;
    if (team.team_leader_id !== memberId) {
      toast({ title: "Not allowed", description: "Only the team leader can delete this team.", variant: "destructive" });
      return;
    }
    try {
      setDeletingTeam(true);
      await notifyTeamDeletion(team.id, memberId);
      // Delete the team - cascade will remove team_members, invites, etc. per schema
      const { error } = await supabase
        .from("hackathon_teams")
        .delete()
        .eq("id", team.id);
      if (error) throw error;

      toast({ title: "Team deleted", description: "Your team and related memberships were removed." });
      setTeam(null);
      setInviteLinks([]);
      setChatMessages([]);
      setChatInput("");
      // Refresh lists so the UI reflects changes
      if (hackathonId && memberId) {
        await loadTeamsAndPlayers(hackathonId, memberId);
      }
    } catch (e: any) {
      toast({ title: "Failed to delete team", description: e.message, variant: "destructive" });
    } finally {
      setDeletingTeam(false);
    }
  }

  async function leaveTeam() {
    if (!team || !memberId) return;
    if (team.team_leader_id === memberId) {
      toast({ title: "Cannot leave", description: "Team leaders cannot leave. Delete the team or transfer leadership first.", variant: "destructive" });
      return;
    }

    try {
      // Remove member from team
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", team.id)
        .eq("member_id", memberId);

      if (error) throw error;

      toast({ title: "Left team", description: "You have successfully left the team." });
      setTeam(null);
      setInviteLinks([]);
      setChatMessages([]);
      setChatInput("");
      // Refresh lists
      if (hackathonId && memberId) {
        await loadTeamsAndPlayers(hackathonId, memberId);
      }
    } catch (e: any) {
      toast({ title: "Failed to leave team", description: e.message, variant: "destructive" });
    }
  }

  async function removeMember(memberIdToRemove: string) {
    if (!team || !memberId) return;
    if (team.team_leader_id !== memberId) {
      toast({ title: "Not allowed", description: "Only the team leader can remove members.", variant: "destructive" });
      return;
    }
    if (memberIdToRemove === team.team_leader_id) {
      toast({ title: "Cannot remove", description: "Team leaders cannot remove themselves.", variant: "destructive" });
      return;
    }

    try {
      // Remove member from team
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", team.id)
        .eq("member_id", memberIdToRemove);

      if (error) throw error;

      // Reload team data
      const teamId = await loadMemberTeam(hackathonId!, memberId);
      if (teamId) {
        await loadInviteLinks(teamId);
      }

      toast({ title: "Member removed", description: "The member has been removed from your team." });
    } catch (e: any) {
      toast({ title: "Failed to remove member", description: e.message, variant: "destructive" });
    }
  }

  async function generateInviteLink() {
    if (!team || !hackathonId || !memberId || team.team_leader_id !== memberId) {
      toast({ title: "Unauthorized", description: "Only team leaders can generate invite links.", variant: "destructive" });
      return;
    }

    setGeneratingInvite(true);
    try {
      // Use edge function to generate invite (bypasses RLS)
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate_invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          hackathon_id: hackathonId,
          team_id: team.id,
          created_by: memberId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate invite link");
      }

      // Reload invite links to show the new one
      await loadInviteLinks(team.id);
      
      toast({ title: "Invite link generated!", description: "Share this link with your teammates." });
    } catch (error: any) {
      console.error("Error generating invite link:", error);
      toast({ title: "Failed to generate invite link", description: error.message, variant: "destructive" });
    } finally {
      setGeneratingInvite(false);
    }
  }

  async function copyInviteLink(token: string) {
    const inviteUrl = `${window.location.origin}/team-invite/${token}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(token);
      toast({ title: "Link copied!", description: "Invite link copied to clipboard." });
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      toast({ title: "Failed to copy", description: "Please copy the link manually.", variant: "destructive" });
    }
  }

  async function deleteInviteLink(inviteId: string) {
    try {
      const { error } = await supabase
        .from("hackathon_invites")
        .update({ is_active: false })
        .eq("id", inviteId);

      if (error) throw error;

      toast({ title: "Invite link deleted", description: "The invite link has been deactivated." });
      if (team) await loadInviteLinks(team.id);
    } catch (error: any) {
      console.error("Error deleting invite link:", error);
      toast({ title: "Failed to delete invite link", description: error.message, variant: "destructive" });
    }
  }

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
            members(id, full_name, email, area_of_interest, verified_badge, star_badge, custom_badge)
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
            role: tm.role,
            area_of_interest: tm.members?.area_of_interest || "",
            verified_badge: tm.members?.verified_badge || false,
            star_badge: tm.members?.star_badge || false,
            custom_badge: tm.members?.custom_badge || null
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
    if (!memberId || !hackathonId) return;
    const trimmedName = teamName.trim();
    if (!trimmedName) {
      setTeamNameError("Team name is required.");
      toast({ title: "Team name required", description: "Please enter a team name." });
      return;
    }

    try {
      // Ensure the member is not already in a team for this hackathon
      const { data: existingMembership } = await supabase
        .from("team_members")
        .select("team_id, hackathon_teams(hackathon_id)")
        .eq("member_id", memberId);

      if (Array.isArray(existingMembership) && existingMembership.some((tm: any) => tm.hackathon_teams?.hackathon_id === hackathonId)) {
        toast({ title: "Already in a team", description: "You can only be in one team per hackathon.", variant: "destructive" });
        setShowCreateTeam(false);
        return;
      }

      setCreatingTeam(true);
      setTeamNameError(null);

      const { data: existingNames } = await supabase
        .from("hackathon_teams")
        .select("id")
        .eq("hackathon_id", hackathonId)
        .ilike("team_name", trimmedName)
        .limit(1);

      if (existingNames && existingNames.length > 0) {
        setTeamNameError("That team name is already taken for this hackathon.");
        toast({ title: "Name unavailable", description: "Choose another team name.", variant: "destructive" });
        return;
      }

      const { data: teamData, error } = await supabase
        .from("hackathon_teams")
        .insert({
          hackathon_id: hackathonId,
          team_name: trimmedName,
          team_leader_id: memberId,
          status: "forming",
          max_members: 4
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from("team_members")
        .insert({
          team_id: teamData.id,
          member_id: memberId,
          role: "leader"
        });

      const { data: createdTeam } = await supabase
        .from("hackathon_teams")
        .select(`
          *,
          team_members(
            member_id,
            role,
            members(id, full_name, email, area_of_interest)
          )
        `)
        .eq("id", teamData.id)
        .single();

      if (createdTeam) {
        const formattedTeam = {
          ...createdTeam,
          members: (createdTeam.team_members || []).map((tm: any) => ({
            member_id: tm.member_id,
            full_name: tm.members?.full_name || "",
            email: tm.members?.email || "",
            role: tm.role,
            area_of_interest: tm.members?.area_of_interest || ""
          }))
        };
        setTeam(formattedTeam as Team);
        await loadInviteLinks(createdTeam.id);
      }

      toast({ title: "Team created!", description: "You are the team leader. Generate an invite link to add members." });
      setShowCreateTeam(false);
      setTeamName("");
      setTeamNameError(null);
    } catch (e: any) {
      if (String(e?.message || "").includes("duplicate key")) {
        setTeamNameError("That team name is already taken.");
        toast({ title: "Name unavailable", description: "Pick another name.", variant: "destructive" });
      } else {
        toast({ title: "Failed to create team", description: e.message });
      }
    } finally {
      setCreatingTeam(false);
    }
  }

  async function joinTeam(teamId: string) {
    if (!memberId || !hackathonId) return;
    if (hasTeam) {
      toast({ title: "Already in a team", description: "You can only be in one team per hackathon.", variant: "destructive" });
      return;
    }

    try {
      // Get team and leader info
      const { data: teamData, error: teamError } = await supabase
        .from("hackathon_teams")
        .select("id, team_name, team_leader_id, max_members, team_members(count)")
        .eq("id", teamId)
        .single();

      if (teamError || !teamData) {
        throw new Error("Team not found");
      }

      // Check if team has space
      const { data: members } = await supabase
        .from("team_members")
        .select("member_id")
        .eq("team_id", teamId);

      if (members && members.length >= (teamData.max_members || 4)) {
        toast({ title: "Team full", description: "This team has reached maximum capacity." });
        return;
      }

      // Check if request already exists
      const { data: existingRequest } = await supabase
        .from("team_requests")
        .select("id, status")
        .eq("team_id", teamId)
        .eq("from_member_id", memberId)
        .eq("status", "pending")
        .maybeSingle();

      if (existingRequest) {
        toast({ title: "Request already sent", description: "You've already sent a join request to this team.", variant: "default" });
        return;
      }

      // Get current member info for notification
      const { data: memberData } = await supabase
        .from("members")
        .select("id, full_name, email, area_of_interest")
        .eq("id", memberId)
        .single();

      // Send join request to leader
      const { data: requestData, error: requestError } = await supabase
        .from("team_requests")
        .insert({
          team_id: teamId,
          from_member_id: memberId,
          to_member_id: teamData.team_leader_id,
          status: "pending"
        })
        .select("id")
        .single();

      if (requestError) throw requestError;

      // Update pending requests map
      if (requestData?.id) {
        setPendingRequests((prev) => new Map(prev).set(teamId, requestData.id));
      }

      // Create notification for leader
      if (teamData.team_leader_id && memberData) {
        await supabase
          .from("member_notifications")
          .insert({
            member_id: teamData.team_leader_id,
            notification_type: "team_request",
            title: `Join Request: ${teamData.team_name}`,
            message: `${memberData.full_name}${memberData.area_of_interest ? ` (${memberData.area_of_interest})` : ""} wants to join your team "${teamData.team_name}"`,
            related_id: teamId,
            related_type: "team",
            action_url: `/hackathons/${hackathonId}?tab=teams`,
            metadata: {
              team_id: teamId,
              hackathon_id: hackathonId,
              from_member_id: memberId,
              from_member_name: memberData.full_name,
              from_member_interest: memberData.area_of_interest || null,
            }
          });
      }

      toast({ 
        title: "Join request sent!", 
        description: `Your request has been sent to the team leader. You'll be notified once they respond.` 
      });
      
      // Reload teams to update button status
      if (hackathonId) {
        await loadTeamsAndPlayers(hackathonId, memberId);
      }
      setShowJoinTeam(null);
    } catch (e: any) {
      toast({ title: "Failed to send join request", description: e.message, variant: "destructive" });
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
            <div className="flex items-center gap-3">
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
                        className="flex flex-col items-start gap-1 cursor-pointer group relative"
                        onSelect={(event) => {
                          event.preventDefault();
                          if (!n.is_read) {
                            void markNotificationRead(n.id);
                          }
                          handleNotificationClick(n);
                        }}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${n.is_read ? "bg-muted" : "bg-primary"}`}></span>
                            <span className="font-medium truncate">{n.title || (n.notification_type === "team_invite" ? "Team Invitation" : "Update")}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteNotification(n.id, e);
                            }}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2 w-full">{n.body || n.message || ""}</div>
                        <div className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Badge variant={hackathon.status === "ongoing" ? "default" : "secondary"} className="text-xs px-3 py-0.5">
                {hackathon.status.toUpperCase()}
              </Badge>
            </div>
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
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
            {hackathon.registration_deadline && (
              <Card className="bg-purple-900/40 border-purple-700/60 backdrop-blur-md shadow-lg">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-purple-200">
                    <Clock className="w-4 h-4 text-purple-300 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-purple-300/80 mb-0.5">Registration Deadline</p>
                      <p className="font-semibold text-sm truncate">{formatDate(hackathon.registration_deadline)}</p>
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
            <TabsList className="grid w-full grid-cols-6 bg-muted/50 backdrop-blur-sm h-9 p-0.5">
              <TabsTrigger value="overview" className="text-sm">Overview</TabsTrigger>
              <TabsTrigger value="teams" className="text-sm">Teams</TabsTrigger>
              <TabsTrigger value="resources" className="text-sm">Resources</TabsTrigger>
              <TabsTrigger value="submissions" className="text-sm">Submissions</TabsTrigger>
              {hackathon.rules_markdown && <TabsTrigger value="rules" className="text-sm">Rules</TabsTrigger>}
              {resultsPublished && <TabsTrigger value="results" className="text-sm">Results</TabsTrigger>}
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              {hackathon.description && (
                <Card className="shadow-lg border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-primary" />
                      About This Hackathon
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">{hackathon.description}</p>
                  </CardContent>
                </Card>
              )}

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

              {!hackathon.description && !hackathon.details_markdown && !hackathon.schedule_markdown && (
                <Card className="shadow-lg border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-muted-foreground">
                        Welcome to <span className="font-semibold">{hackathon.title}</span>! This hackathon is designed to challenge participants and showcase innovative solutions.
                      </p>
                      {hackathon.start_date && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Starts: {formatDate(hackathon.start_date)}
                            {hackathon.end_date && ` • Ends: ${formatDate(hackathon.end_date)}`}
                          </span>
                        </div>
                      )}
                      {hackathon.location && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{hackathon.location}</span>
                        </div>
                      )}
                      <div className="pt-4 border-t">
                        <p className="text-sm font-medium mb-2">What to expect:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          <li>Form teams or compete individually</li>
                          <li>Access resources and guidelines</li>
                          <li>Submit your project before the deadline</li>
                          <li>Compete for prizes and recognition</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

            </TabsContent>
            {/* Rules Tab */}
            {hackathon.rules_markdown && (
              <TabsContent value="rules" className="space-y-6">
                <Card className="shadow-xl border-2">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl">Rules & Guidelines</CardTitle>
                    <CardDescription>Read carefully before forming teams and submitting</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: hackathon.rules_markdown }} />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Teams Tab - Premium Team Management */}
            <TabsContent value="teams" className="space-y-8">
              {hasTeam ? (
                <>
                  <Card className="shadow-xl border-2">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl flex items-center gap-3">
                          <Users className="w-6 h-6" />
                          Your Team: {team.team_name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {team.team_leader_id === memberId && team.members.length < team.max_members && inviteLinks.length === 0 && (
                            <Button 
                              size="sm"
                              onClick={generateInviteLink}
                              disabled={generatingInvite}
                            >
                              {generatingInvite ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <LinkIcon className="w-4 h-4 mr-2" />
                                  Generate Invite Link
                                </>
                              )}
                            </Button>
                          )}
                          {team.team_leader_id === memberId && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={deleteTeam}
                              disabled={deletingTeam}
                            >
                              {deletingTeam ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Team
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Team Members */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg">Team Members</h3>
                          <p className="text-sm text-muted-foreground">
                            {team.members.length} / {team.max_members} members
                          </p>
                        </div>
                        <div className="grid gap-2">
                          {team.members.map((member) => (
                            <div key={member.member_id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <Badge 
                                    variant={member.role === "leader" ? "default" : "secondary"} 
                                    className={`text-xs shrink-0 ${member.role === "leader" ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50" : "bg-purple-500/20 text-purple-300 border-purple-500/50"}`}
                                  >
                                    {member.role === "leader" ? "Leader" : "Member"}
                                  </Badge>
                                  <p className="font-medium truncate">{member.full_name}</p>
                                  <PremiumBadge 
                                    verified={member.verified_badge} 
                                    star={member.star_badge} 
                                    custom={member.custom_badge} 
                                    size="sm" 
                                  />
                                  {member.area_of_interest && (
                                    <Badge variant="outline" className="text-xs bg-background/50 border-primary/30 text-primary shrink-0">
                                      {member.area_of_interest}
                                    </Badge>
                                  )}
                                </div>
                                <span 
                                  className="text-xs text-muted-foreground truncate max-w-[200px]"
                                  title={member.email}
                                >
                                  {member.email}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 ml-3">
                                {team.team_leader_id === memberId && member.role !== "leader" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      if (confirm(`Remove ${member.full_name} from the team?`)) {
                                        removeMember(member.member_id);
                                      }
                                    }}
                                    title="Remove member"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                                {team.team_leader_id !== memberId && member.member_id === memberId && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      if (confirm("Are you sure you want to leave this team?")) {
                                        leaveTeam();
                                      }
                                    }}
                                  >
                                    Leave Team
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Invite Links Section (Team Leader Only) */}
                      {team.team_leader_id === memberId && (
                        <div className="space-y-3 pt-4 border-t">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-lg">Invite Links</h3>
                            {team.members.length < team.max_members && (
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={generateInviteLink}
                                disabled={generatingInvite}
                              >
                                {generatingInvite ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <LinkIcon className="w-4 h-4 mr-2" />
                                    Generate New Link
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                          {inviteLinks.length > 0 ? (
                            <div className="space-y-3">
                              {inviteLinks.map((invite) => {
                                const inviteUrl = `${window.location.origin}/team-invite/${invite.invite_token}`;
                                const isExpired = new Date(invite.expires_at) < new Date();
                                const isUsedUp = invite.uses_count >= invite.max_uses;
                                const isCopied = copiedLink === invite.invite_token;
                                
                                return (
                                  <div key={invite.id} className="p-4 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-lg border-2 border-primary/20">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-3">
                                          <LinkIcon className="w-5 h-5 text-primary flex-shrink-0" />
                                          <code className="text-sm bg-background/80 px-3 py-2 rounded border break-all font-mono">
                                            {inviteUrl}
                                          </code>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                                          <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            Uses: {invite.uses_count} / {invite.max_uses}
                                          </span>
                                          <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Expires: {new Date(invite.expires_at).toLocaleDateString()}
                                          </span>
                                          {isExpired && <Badge variant="destructive" className="text-xs">Expired</Badge>}
                                          {isUsedUp && <Badge variant="secondary" className="text-xs">Used Up</Badge>}
                                          {!isExpired && !isUsedUp && <Badge variant="default" className="text-xs bg-green-500">Active</Badge>}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          Share this link with teammates to invite them to your team
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          onClick={() => copyInviteLink(invite.invite_token)}
                                          disabled={isExpired || isUsedUp}
                                          className="shrink-0"
                                        >
                                          {isCopied ? (
                                            <>
                                              <Check className="w-4 h-4 mr-2" />
                                              Copied!
                                            </>
                                          ) : (
                                            <>
                                              <Copy className="w-4 h-4 mr-2" />
                                              Copy Link
                                            </>
                                          )}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => deleteInviteLink(invite.id)}
                                        >
                                          <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-6 text-muted-foreground">
                              <LinkIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p>No invite links yet. Generate one to invite teammates!</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Invite Teammates Button */}
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
                          Browse & Invite Teammates
                        </Button>
                      )}

                      {/* Team Chat */}
                      <div className="space-y-3 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">Team Chat</h3>
                            <p className="text-xs text-muted-foreground">Only teammates can view these messages.</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            History clears if the team is deleted
                          </Badge>
                        </div>
                        <div className="bg-muted/20 rounded-lg border flex flex-col h-80">
                          <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={chatScrollRef}>
                            {chatLoading ? (
                              <div className="space-y-2">
                                <div className="h-4 bg-muted rounded animate-pulse" />
                                <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
                                <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                              </div>
                            ) : chatMessages.length === 0 ? (
                              <div className="text-center text-xs text-muted-foreground py-8">
                                <p>No messages yet. Be the first to say hi!</p>
                              </div>
                            ) : (
                              chatMessages.map((msg) => {
                                const isSelf = memberId === msg.sender_member_id;
                                return (
                                  <div key={msg.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                                    <div
                                      className={`max-w-[80%] rounded-lg p-3 text-sm shadow-sm ${
                                        isSelf ? "bg-primary text-primary-foreground" : "bg-background border"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-3 text-[11px] opacity-80 mb-1">
                                        <div className="flex items-center gap-2 truncate">
                                          <span>{isSelf ? "You" : msg.sender_name}</span>
                                          {!isSelf && (
                                            <PremiumBadge 
                                              verified={msg.sender_verified_badge} 
                                              star={msg.sender_star_badge} 
                                              custom={msg.sender_custom_badge} 
                                              size="sm" 
                                            />
                                          )}
                                        </div>
                                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                      </div>
                                      <p className="whitespace-pre-wrap break-words text-xs sm:text-sm">{msg.message}</p>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                          <div className="border-t bg-background/50 p-3">
                            <div className="flex gap-2 items-end">
                              <Textarea
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={handleChatInputKeyDown}
                                placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                                className="resize-none flex-1 bg-background/80 border-primary/20 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                disabled={!team || sendingChat}
                                rows={2}
                                maxLength={2000}
                              />
                              <Button
                                onClick={() => void handleSendChatMessage()}
                                disabled={!chatInput.trim() || sendingChat}
                                className="shrink-0 h-[52px] w-[120px] bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                size="lg"
                              >
                                {sendingChat ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Send
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
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
                            {!hasTeam && t.members.length < t.max_members ? (
                              pendingRequests.has(t.id) ? (
                                <Button size="sm" variant="outline" disabled>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  Request Sent
                                </Button>
                              ) : (
                                <Button size="sm" onClick={() => joinTeam(t.id)}>
                                  Join
                                </Button>
                              )
                            ) : (
                              <Button size="sm" variant="outline" disabled>
                                {hasTeam ? "In a Team" : "Full"}
                              </Button>
                            )}
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground font-semibold">Member Interests:</p>
                            <div className="flex flex-wrap gap-2">
                              {t.members
                                .filter((m) => m.area_of_interest)
                                .map((m, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {m.area_of_interest}
                                  </Badge>
                                ))}
                              {t.members.filter((m) => m.area_of_interest).length === 0 && (
                                <p className="text-xs text-muted-foreground italic">No interests listed</p>
                              )}
                            </div>
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
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-lg">{player.full_name}</p>
                              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <Mail className="w-3 h-3" />
                                <span>{player.email}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1"
                                  onClick={() => {
                                    navigator.clipboard.writeText(player.email);
                                    toast({ title: "Email copied!", description: `${player.email} copied to clipboard.` });
                                  }}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            {hasTeam && team && team.team_leader_id === memberId && team.members.length < team.max_members && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={invitingPlayerId === player.id}
                                onClick={async () => {
                                  setInvitingPlayerId(player.id);
                                  try {
                                    const { error } = await supabase
                                      .from("team_requests")
                                      .insert({
                                        team_id: team.id,
                                        from_member_id: memberId,
                                        to_member_id: player.id,
                                        status: "pending"
                                      });
                                    if (error) throw error;
                                    toast({ 
                                      title: "Invitation sent!", 
                                      description: `Invitation sent to ${player.full_name}. They'll receive a notification shortly.` 
                                    });
                                  } catch (e: any) {
                                    if (e.message?.includes("duplicate") || e.message?.includes("unique")) {
                                      toast({ 
                                        title: "Already invited", 
                                        description: `${player.full_name} already has a pending invitation.`, 
                                        variant: "destructive" 
                                      });
                                    } else {
                                      toast({ title: "Failed to send invitation", description: e.message || "Please try again in a moment.", variant: "destructive" });
                                    }
                                  } finally {
                                    setInvitingPlayerId(null);
                                  }
                                }}
                              >
                                {invitingPlayerId === player.id ? (
                                  <>
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3 h-3 mr-1" />
                                    Invite
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
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
                onChange={(e) => {
                  setTeamName(e.target.value);
                  if (teamNameError) setTeamNameError(null);
                }}
                placeholder="Enter team name"
              />
              {teamNameError && (
                <p className="text-xs text-destructive mt-1">{teamNameError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTeam(false)} disabled={creatingTeam}>Cancel</Button>
            <Button onClick={createTeam} disabled={!teamName.trim() || creatingTeam}>
              {creatingTeam ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Team"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Invite Dialog */}
      <Dialog
        open={inviteDialogOpen}
        onOpenChange={(open) => {
          setInviteDialogOpen(open);
          if (!open) {
            setSelectedInvite(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          {selectedInvite ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedInvite.is_incoming ? `Join Request: ${selectedInvite.team_name}` : `Join ${selectedInvite.team_name}`}
                </DialogTitle>
                <DialogDescription>
                  {selectedInvite.is_incoming 
                    ? "A member wants to join your team"
                    : selectedInvite.hackathon_title || "Hackathon team invitation"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {selectedInvite.is_incoming ? (
                  // Leader viewing join request from a member
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">Join Request From</p>
                    <p className="font-semibold">{selectedInvite.requester_name}</p>
                    {selectedInvite.requester_interest && (
                      <Badge variant="outline" className="mt-2">
                        {selectedInvite.requester_interest}
                      </Badge>
                    )}
                  </div>
                ) : (
                  // Member viewing invitation from leader
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
                )}
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
