import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-admin-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const token = req.headers.get("x-admin-token");
  if (token !== Deno.env.get("MODERATOR_TOKEN")) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SM_SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SM_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response("Missing env", { status: 500, headers: corsHeaders });
  }

  try {
    const { event_id, member_id, email, method = "qr", recorded_by } = await req.json();
    if (!event_id || (!member_id && !email)) {
      return new Response("event_id and member_id or email are required", { status: 400, headers: corsHeaders });
    }

    // Lookup member by ID or email
    let member = null;
    if (member_id) {
      const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${member_id}&select=id,full_name,email`, {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      });
      const memberRows = memberRes.ok ? await memberRes.json() : [];
      member = Array.isArray(memberRows) && memberRows[0] ? memberRows[0] : null;
    } else if (email) {
      const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/members?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,full_name,email`, {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      });
      const memberRows = memberRes.ok ? await memberRes.json() : [];
      member = Array.isArray(memberRows) && memberRows[0] ? memberRows[0] : null;
    }
    
    if (!member) {
      return new Response(JSON.stringify({ status: "member_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure member is registered for the event
    const regRes = await fetch(`${SUPABASE_URL}/rest/v1/event_registrations?event_id=eq.${event_id}&member_id=eq.${member.id}&select=id,status`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    const regRows = regRes.ok ? await regRes.json() : [];
    const registration = Array.isArray(regRows) && regRows[0] ? regRows[0] : null;
    if (!registration) {
      return new Response(JSON.stringify({ status: "not_registered" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already checked in
    const existingCheckinRes = await fetch(`${SUPABASE_URL}/rest/v1/event_checkins?event_id=eq.${event_id}&member_id=eq.${member.id}&select=id,created_at,method,recorded_by`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    const existingCheckins = existingCheckinRes.ok ? await existingCheckinRes.json() : [];
    if (Array.isArray(existingCheckins) && existingCheckins.length) {
      return new Response(JSON.stringify({ status: "already_checked_in", checkin: existingCheckins[0], member }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record check-in
    const checkinRes = await fetch(`${SUPABASE_URL}/rest/v1/event_checkins`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        event_id,
        member_id: member.id,
        method,
        recorded_by: recorded_by || "admin",
      }),
    });

    if (!checkinRes.ok) {
      return new Response(await checkinRes.text(), { status: checkinRes.status, headers: corsHeaders });
    }
    const checkinRows = await checkinRes.json();
    const checkin = Array.isArray(checkinRows) && checkinRows[0] ? checkinRows[0] : null;

    // Update registration status to attended (best effort)
    await fetch(`${SUPABASE_URL}/rest/v1/event_registrations?event_id=eq.${event_id}&member_id=eq.${member.id}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status: "attended" }),
    }).catch(() => {});

    // Log activity (best effort)
    await fetch(`${SUPABASE_URL}/rest/v1/member_activity`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        member_id: member.id,
        activity_type: "event_attended",
        activity_data: { event_id, method },
        related_id: event_id,
      }),
    }).catch(() => {});

    return new Response(JSON.stringify({ status: "checked_in", member, checkin }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, {
      status: 400,
      headers: corsHeaders,
    });
  }
});


