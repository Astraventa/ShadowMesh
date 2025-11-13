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
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("SM_SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SM_SERVICE_ROLE_KEY")!;

    const { hackathon_id, team_id, created_by } = await req.json();

    if (!hackathon_id || !team_id || !created_by) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: hackathon_id, team_id, created_by" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify that the user is the team leader
    const teamRes = await fetch(
      `${SUPABASE_URL}/rest/v1/hackathon_teams?id=eq.${team_id}&select=team_leader_id`,
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

    if (!team || team.team_leader_id !== created_by) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Only team leaders can generate invite links" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate secure token
    const token = crypto.randomUUID() + "-" + Date.now().toString(36);
    
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Insert invite using service role key (bypasses RLS)
    const insertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/hackathon_invites`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          hackathon_id,
          team_id,
          created_by,
          invite_token: token,
          expires_at: expiresAt.toISOString(),
          max_uses: 3,
          uses_count: 0,
          is_active: true,
        }),
      }
    );

    if (!insertRes.ok) {
      const errorText = await insertRes.text();
      console.error("Failed to insert invite:", errorText);
      throw new Error("Failed to create invite link");
    }

    const data = await insertRes.json();
    const invite = Array.isArray(data) ? data[0] : data;

    return new Response(
      JSON.stringify({ success: true, invite }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error generating invite:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate invite link" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

