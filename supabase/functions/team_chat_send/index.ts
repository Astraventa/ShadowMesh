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

    const { team_id, member_id, message } = await req.json();

    if (!team_id || !member_id || !message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing required fields: team_id, member_id, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return new Response(
        JSON.stringify({ error: "Message cannot be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (trimmedMessage.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Message too long (max 2000 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const headers = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    };

    // Load team
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

    // Verify membership
    let isMember = team.team_leader_id === member_id;
    if (!isMember) {
      const membershipRes = await fetch(
        `${SUPABASE_URL}/rest/v1/team_members?team_id=eq.${team_id}&member_id=eq.${member_id}&select=member_id`,
        { headers },
      );
      if (!membershipRes.ok) throw new Error("Failed to verify membership");
      const membership = await membershipRes.json();
      isMember = Array.isArray(membership) && membership.length > 0;
    }

    if (!isMember) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load sender info
    const memberRes = await fetch(
      `${SUPABASE_URL}/rest/v1/members?id=eq.${member_id}&select=id,full_name,email`,
      { headers },
    );
    if (!memberRes.ok) throw new Error("Failed to load member");
    const memberRows = await memberRes.json();
    const sender = Array.isArray(memberRows) ? memberRows[0] : null;
    if (!sender) {
      return new Response(
        JSON.stringify({ error: "Member not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Insert chat message
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/team_messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        team_id,
        hackathon_id: team.hackathon_id,
        sender_member_id: member_id,
        message: trimmedMessage,
      }),
    });

    if (!insertRes.ok) {
      const errorText = await insertRes.text();
      console.error("Failed to insert chat message:", errorText);
      let errorMsg = "Failed to send message";
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.message || errorJson.error || errorMsg;
      } catch {
        errorMsg = errorText || errorMsg;
      }
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let insertedRows;
    try {
      insertedRows = await insertRes.json();
    } catch (parseError) {
      console.error("Failed to parse insert response:", parseError);
      return new Response(
        JSON.stringify({ error: "Failed to process message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const inserted = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;
    if (!inserted || !inserted.id) {
      console.error("Invalid insert response:", insertedRows);
      return new Response(
        JSON.stringify({ error: "Message was not saved properly" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const formattedMessage = {
      id: inserted.id,
      created_at: inserted.created_at,
      team_id: inserted.team_id,
      hackathon_id: inserted.hackathon_id,
      sender_member_id: inserted.sender_member_id,
      message: inserted.message,
      sender_name: sender.full_name,
      sender_email: sender.email,
    };

    // Fetch hackathon title for notifications
    let hackathonTitle = "";
    const hackathonRes = await fetch(
      `${SUPABASE_URL}/rest/v1/events?id=eq.${team.hackathon_id}&select=title`,
      { headers },
    );
    if (hackathonRes.ok) {
      const hackathonRows = await hackathonRes.json();
      hackathonTitle = Array.isArray(hackathonRows) && hackathonRows[0]?.title ? hackathonRows[0].title : "";
    }

    // Gather all team members
    const teamMembersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/team_members?team_id=eq.${team_id}&select=member_id`,
      { headers },
    );
    if (!teamMembersRes.ok) {
      throw new Error("Failed to load team members");
    }
    const teamMembersData = await teamMembersRes.json();
    const recipientIds = new Set<string>();
    recipientIds.add(team.team_leader_id);
    (teamMembersData || []).forEach((row: any) => {
      if (row.member_id) {
        recipientIds.add(row.member_id);
      }
    });
    recipientIds.delete(member_id);

    if (recipientIds.size > 0) {
      const notificationsPayload = Array.from(recipientIds).map((recipientId) => ({
        member_id: recipientId,
        notification_type: "team_chat",
        title: `New message in ${team.team_name}`,
        message: `${sender.full_name} in ${hackathonTitle || "hackathon"}: ${trimmedMessage.slice(0, 120)}`,
        related_id: team_id,
        related_type: "team",
        action_url: `/hackathons/${team.hackathon_id}?tab=teams`,
        metadata: {
          team_id,
          hackathon_id: team.hackathon_id,
          sender_member_id: member_id,
          sender_name: sender.full_name,
        },
      }));

      const notifyRes = await fetch(`${SUPABASE_URL}/rest/v1/member_notifications`, {
        method: "POST",
        headers,
        body: JSON.stringify(notificationsPayload),
      });

      if (!notifyRes.ok) {
        const text = await notifyRes.text();
        console.warn("Failed to insert notifications:", text);
      }
    }

    const responseBody = JSON.stringify({ success: true, message: formattedMessage });
    return new Response(
      responseBody,
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Content-Length": responseBody.length.toString()
        } 
      },
    );
  } catch (error: any) {
    console.error("Error sending chat message:", error);
    const errorMessage = error?.message || error?.toString() || "Failed to send message";
    const errorBody = JSON.stringify({ error: errorMessage });
    return new Response(
      errorBody,
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Content-Length": errorBody.length.toString()
        } 
      },
    );
  }
});

