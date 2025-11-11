import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SM_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    // GET /team_invite?token=xxx - Verify invite link
    if (req.method === "GET" && token) {

      // Get invite details
      const inviteRes = await fetch(
        `${SUPABASE_URL}/rest/v1/hackathon_invites?invite_token=eq.${token}&is_active=eq.true&select=*,hackathon_teams(*,hackathon_id,team_name,max_members,team_members(count))`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        }
      );

      if (!inviteRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch invite" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const invites = await inviteRes.json();
      const invite = Array.isArray(invites) && invites[0] ? invites[0] : null;

      if (!invite) {
        return new Response(
          JSON.stringify({ error: "Invite not found or expired" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check expiration
      const expiresAt = new Date(invite.expires_at);
      if (expiresAt < new Date()) {
        return new Response(
          JSON.stringify({ error: "Invite link has expired" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check usage limit
      if (invite.uses_count >= invite.max_uses) {
        return new Response(
          JSON.stringify({ error: "Invite link has reached maximum uses" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get team details
      const team = invite.hackathon_teams;
      if (!team) {
        return new Response(
          JSON.stringify({ error: "Team not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check team capacity
      const memberCount = team.team_members?.[0]?.count || 0;
      if (memberCount >= team.max_members) {
        return new Response(
          JSON.stringify({ error: "Team is full" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          invite: {
            id: invite.id,
            team_id: invite.team_id,
            team_name: team.team_name,
            hackathon_id: invite.hackathon_id,
            expires_at: invite.expires_at,
            uses_remaining: invite.max_uses - invite.uses_count,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /team_invite?token=xxx - Join team via invite
    if (req.method === "POST" && token) {
      const { member_id } = await req.json();

      if (!token || !member_id) {
        return new Response(
          JSON.stringify({ error: "Missing token or member_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify invite (same checks as GET)
      const inviteRes = await fetch(
        `${SUPABASE_URL}/rest/v1/hackathon_invites?invite_token=eq.${token}&is_active=eq.true&select=*,hackathon_teams(*,hackathon_id,team_name,max_members,team_members(count))`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        }
      );

      if (!inviteRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch invite" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const invites = await inviteRes.json();
      const invite = Array.isArray(invites) && invites[0] ? invites[0] : null;

      if (!invite) {
        return new Response(
          JSON.stringify({ error: "Invite not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check expiration
      if (new Date(invite.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Invite expired" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check usage
      if (invite.uses_count >= invite.max_uses) {
        return new Response(
          JSON.stringify({ error: "Invite limit reached" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const team = invite.hackathon_teams;
      const memberCount = team.team_members?.[0]?.count || 0;
      if (memberCount >= team.max_members) {
        return new Response(
          JSON.stringify({ error: "Team is full" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify member is approved for hackathon
      const regRes = await fetch(
        `${SUPABASE_URL}/rest/v1/hackathon_registrations?hackathon_id=eq.${invite.hackathon_id}&member_id=eq.${member_id}&status=eq.approved&select=id`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        }
      );

      if (!regRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to verify registration" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const regs = await regRes.json();
      if (!Array.isArray(regs) || regs.length === 0) {
        return new Response(
          JSON.stringify({ error: "You must be approved for this hackathon to join teams" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already in a team for this hackathon
      const existingTeamRes = await fetch(
        `${SUPABASE_URL}/rest/v1/team_members?member_id=eq.${member_id}&select=team_id,hackathon_teams(hackathon_id)`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        }
      );

      if (existingTeamRes.ok) {
        const existingTeams = await existingTeamRes.json();
        const inTeam = existingTeams.some((tm: any) => 
          tm.hackathon_teams?.hackathon_id === invite.hackathon_id
        );
        
        if (inTeam) {
          return new Response(
            JSON.stringify({ error: "You are already in a team for this hackathon" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Add member to team
      const joinRes = await fetch(`${SUPABASE_URL}/rest/v1/team_members`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          team_id: invite.team_id,
          member_id: member_id,
          role: "member",
        }),
      });

      if (!joinRes.ok) {
        const errorText = await joinRes.text();
        return new Response(
          JSON.stringify({ error: `Failed to join team: ${errorText}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Increment invite usage
      await fetch(
        `${SUPABASE_URL}/rest/v1/hackathon_invites?id=eq.${invite.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uses_count: invite.uses_count + 1,
          }),
        }
      );

      // Create notification for team leader
      const { data: memberData } = await fetch(
        `${SUPABASE_URL}/rest/v1/members?id=eq.${member_id}&select=full_name,email`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        }
      ).then(r => r.json());

      const member = Array.isArray(memberData) && memberData[0] ? memberData[0] : null;

      if (member && invite.created_by) {
        await fetch(`${SUPABASE_URL}/rest/v1/member_notifications`, {
          method: "POST",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            member_id: invite.created_by,
            notification_type: "team_joined",
            title: "New Team Member",
            message: `${member.full_name} joined your team "${team.team_name}" via invite link`,
            related_id: invite.team_id,
            related_type: "team",
            action_url: `/hackathons/${invite.hackathon_id}?tab=teams`,
          }),
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Successfully joined team",
          team_id: invite.team_id,
          team_name: team.team_name,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Team invite error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

