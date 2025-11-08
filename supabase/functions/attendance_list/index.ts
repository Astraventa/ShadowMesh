import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-attendance-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Attendance staff credentials (should match AttendanceCheckin.tsx)
const ATTENDANCE_USERNAME = "attendance_staff";
const ATTENDANCE_PASSWORD = "checkin2024!";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  // Check for attendance token or credentials
  const token = req.headers.get('x-attendance-token');
  const expectedToken = Deno.env.get('ATTENDANCE_TOKEN') || `${ATTENDANCE_USERNAME}:${ATTENDANCE_PASSWORD}`;
  
  // Also support username/password in body for initial auth
  let authenticated = false;
  if (token && token === expectedToken) {
    authenticated = true;
  } else {
    try {
      const payload = await req.json();
      const username = payload?.username;
      const password = payload?.password;
      if (username === ATTENDANCE_USERNAME && password === ATTENDANCE_PASSWORD) {
        authenticated = true;
      }
    } catch {
      // If JSON parse fails, check token again
      if (token === expectedToken) {
        authenticated = true;
      }
    }
  }

  if (!authenticated) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  try {
    // Re-parse body if we already parsed it
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const type = payload?.type as string | undefined;
    const eventId = payload?.event_id as string | undefined;
    const SUPABASE_URL = Deno.env.get('SM_SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SM_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return new Response('Missing service env', { status: 500, headers: corsHeaders });
    }

    if (type === 'events') {
      // Get active events only
      const url = `${SUPABASE_URL}/rest/v1/events?select=id,title,start_date,event_type,is_active&is_active=eq.true&order=start_date.desc`;
      
      const res = await fetch(url, {
        headers: { 
          'apikey': SERVICE_KEY, 
          'Authorization': `Bearer ${SERVICE_KEY}` 
        },
      });
      
      if (!res.ok) {
        return new Response(`error: ${await res.text()}`, { status: 502, headers: corsHeaders });
      }
      
      const data = await res.json();
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (type === 'attendance_details') {
      if (!eventId) {
        return new Response('Missing event_id', { status: 400, headers: corsHeaders });
      }

      // Get event details
      const eventRes = await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${eventId}&select=id,title,start_date,event_type,is_member_only,location,description`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      
      if (!eventRes.ok) {
        return new Response(`error: ${await eventRes.text()}`, { status: 502, headers: corsHeaders });
      }
      
      const eventData = await eventRes.json();
      const event = eventData?.[0];
      if (!event) {
        return new Response('Event not found', { status: 404, headers: corsHeaders });
      }

      // Get registrations
      const regRes = await fetch(`${SUPABASE_URL}/rest/v1/event_registrations?event_id=eq.${eventId}&select=id,member_id,status,created_at,members(id,full_name,email,secret_code)`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      
      if (!regRes.ok) {
        return new Response(`error: ${await regRes.text()}`, { status: 502, headers: corsHeaders });
      }
      
      const registrations = await regRes.json();

      // Get check-ins
      const checkinRes = await fetch(`${SUPABASE_URL}/rest/v1/event_checkins?event_id=eq.${eventId}&select=id,member_id,method,created_at,recorded_by,members(id,full_name,email)`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      
      if (!checkinRes.ok) {
        return new Response(`error: ${await checkinRes.text()}`, { status: 502, headers: corsHeaders });
      }
      
      const checkins = await checkinRes.json();

      return new Response(JSON.stringify({
        data: {
          event,
          registrations,
          checkins,
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response('Invalid type', { status: 400, headers: corsHeaders });
    }
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 500, headers: corsHeaders });
  }
});

