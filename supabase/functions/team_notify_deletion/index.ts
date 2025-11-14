import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("SM_SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SM_SERVICE_ROLE_KEY")!;

    const { team_id, actor_id } = await req.json();

    if (!team_id || !actor_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: team_id, actor_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const headers = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    };

    // Load team with leader info
    const teamRes = await fetch(
      `${SUPABASE_URL}/rest/v1/hackathon_teams?id=eq.${team_id}&select=id,team_name,hackathon_id,team_leader_id`,
      { headers },
    );

    if (!teamRes.ok) throw new Error("Failed to load team");
    const teamRows = await teamRes.json();
    const team = Array.isArray(teamRows) ? teamRows[0] : null;

    if (!team) {
      return new Response(
        JSON.stringify({ error: "Team not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (team.team_leader_id !== actor_id) {
      return new Response(
        JSON.stringify({ error: "Only the team leader can send deletion notifications" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load actor info
    const actorRes = await fetch(
      `${SUPABASE_URL}/rest/v1/members?id=eq.${actor_id}&select=id,full_name`,
      { headers },
    );
    if (!actorRes.ok) throw new Error("Failed to load actor");
    const actorRows = await actorRes.json();
    const actor = Array.isArray(actorRows) ? actorRows[0] : null;

    const actorName = actor?.full_name || "Team leader";

    // Load hackathon title
    let hackathonTitle = "";
    const hackathonRes = await fetch(
      `${SUPABASE_URL}/rest/v1/events?id=eq.${team.hackathon_id}&select=title`,
      { headers },
    );
    if (hackathonRes.ok) {
      const hackathonRows = await hackathonRes.json();
      hackathonTitle = Array.isArray(hackathonRows) && hackathonRows[0]?.title ? hackathonRows[0].title : "";
    }

    // Load members to notify
    const membersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/team_members?team_id=eq.${team_id}&select=member_id`,
      { headers },
    );

    if (!membersRes.ok) throw new Error("Failed to load team members");
    const membersData = await membersRes.json();

    const recipients = new Set<string>();
    (membersData || []).forEach((row: any) => {
      if (row.member_id) {
        recipients.add(row.member_id);
      }
    });
    recipients.add(team.team_leader_id);
    recipients.delete(actor_id);

    if (recipients.size === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No recipients" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const notificationBody = Array.from(recipients).map((memberId) => ({
      member_id: memberId,
      notification_type: "team_deleted",
      title: `${team.team_name} deleted`,
      message: `${actorName} deleted ${team.team_name}${hackathonTitle ? ` (${hackathonTitle})` : ""}.`,
      related_id: team_id,
      related_type: "team",
      action_url: `/hackathons/${team.hackathon_id}?tab=teams`,
      metadata: {
        team_id,
        hackathon_id: team.hackathon_id,
        actor_id,
        actor_name: actorName,
        event: "team_deleted",
      },
    }));

    const notifyRes = await fetch(`${SUPABASE_URL}/rest/v1/member_notifications`, {
      method: "POST",
      headers,
      body: JSON.stringify(notificationBody),
    });

    if (!notifyRes.ok) {
      const text = await notifyRes.text();
      console.error("Failed to send deletion notifications:", text);
      throw new Error("Failed to record notifications");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error sending team deletion notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send notifications" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

