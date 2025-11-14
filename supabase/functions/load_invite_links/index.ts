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

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("SM_SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SM_SERVICE_ROLE_KEY")!;

    const url = new URL(req.url);
    const teamId = url.searchParams.get("team_id");
    const memberId = url.searchParams.get("member_id");

    if (!teamId || !memberId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: team_id, member_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify that the user is the team leader or a team member
    const teamRes = await fetch(
      `${SUPABASE_URL}/rest/v1/hackathon_teams?id=eq.${teamId}&select=team_leader_id,team_members(member_id)`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      }
    );

    if (!teamRes.ok) {
      throw new Error("Failed to verify team");
    }

    const teams = await teamRes.json();
    const team = Array.isArray(teams) && teams[0] ? teams[0] : null;

    if (!team) {
      return new Response(
        JSON.stringify({ error: "Team not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is team leader or member
    const isLeader = team.team_leader_id === memberId;
    const isMember = team.team_members?.some((tm: any) => tm.member_id === memberId) || false;

    if (!isLeader && !isMember) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: You must be a team member to view invite links" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get invite links for this team
    const invitesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/hackathon_invites?team_id=eq.${teamId}&is_active=eq.true&order=created_at.desc`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      }
    );

    if (!invitesRes.ok) {
      throw new Error("Failed to fetch invite links");
    }

    const invites = await invitesRes.json();

    return new Response(
      JSON.stringify({ success: true, invites: Array.isArray(invites) ? invites : [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error loading invite links:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to load invite links" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


