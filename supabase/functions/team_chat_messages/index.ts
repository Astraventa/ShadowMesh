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
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("SM_SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SM_SERVICE_ROLE_KEY")!;

    const url = new URL(req.url);
    const teamId = url.searchParams.get("team_id");
    const memberId = url.searchParams.get("member_id");
    const limitParam = url.searchParams.get("limit");
    const before = url.searchParams.get("before");

    if (!teamId || !memberId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: team_id, member_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const limit = Math.max(1, Math.min(200, Number(limitParam) || 100));

    // Load team to grab metadata
    const teamRes = await fetch(
      `${SUPABASE_URL}/rest/v1/hackathon_teams?id=eq.${teamId}&select=id,team_leader_id`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      },
    );

    if (!teamRes.ok) {
      throw new Error("Failed to load team");
    }

    const teamData = await teamRes.json();
    const team = Array.isArray(teamData) ? teamData[0] : null;

    if (!team) {
      return new Response(
        JSON.stringify({ error: "Team not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Ensure requester is a member or leader
    let isMember = false;
    if (team.team_leader_id === memberId) {
      isMember = true;
    } else {
      const membershipRes = await fetch(
        `${SUPABASE_URL}/rest/v1/team_members?team_id=eq.${teamId}&member_id=eq.${memberId}&select=member_id`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        },
      );

      if (!membershipRes.ok) {
        throw new Error("Failed to verify membership");
      }

      const membership = await membershipRes.json();
      isMember = Array.isArray(membership) && membership.length > 0;
    }

    if (!isMember) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let query = `${SUPABASE_URL}/rest/v1/team_messages?team_id=eq.${teamId}&select=id,created_at,team_id,hackathon_id,sender_member_id,message,member:sender_member_id(full_name,email)&order=created_at.asc&limit=${limit}`;
    if (before) {
      query += `&created_at=lt.${encodeURIComponent(before)}`;
    }

    const messagesRes = await fetch(query, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });

    if (!messagesRes.ok) {
      throw new Error("Failed to load messages");
    }

    const rows = await messagesRes.json();
    const messages = (rows || []).map((row: any) => ({
      id: row.id,
      created_at: row.created_at,
      team_id: row.team_id,
      hackathon_id: row.hackathon_id,
      sender_member_id: row.sender_member_id,
      message: row.message,
      sender_name: row.member?.full_name || "Unknown",
      sender_email: row.member?.email || "",
    }));

    return new Response(
      JSON.stringify({ success: true, messages }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error loading chat messages:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to load messages" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

