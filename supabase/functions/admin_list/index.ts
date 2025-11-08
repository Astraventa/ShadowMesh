import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-admin-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const token = req.headers.get('x-admin-token');
  if (token !== Deno.env.get('MODERATOR_TOKEN')) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const type = payload?.type as string | undefined;
    const status = payload?.status as string | undefined;
    const search = payload?.search as string | undefined;
    const page = typeof payload?.page === 'number' ? payload.page : 0;
    const pageSize = typeof payload?.pageSize === 'number' ? payload.pageSize : 50;
    const SUPABASE_URL = Deno.env.get('SM_SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SM_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return new Response('Missing service env', { status: 500, headers: corsHeaders });
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;

    if (type === 'applications') {
      let url = `${SUPABASE_URL}/rest/v1/join_applications?select=*&order=created_at.desc&limit=${pageSize}&offset=${from}`;
      if (status && status !== 'all') {
        url += `&status=eq.${status}`;
      }
      if (search && search.trim()) {
        const s = encodeURIComponent(`%${search.trim()}%`);
        url += `&or=(full_name.ilike.${s},email.ilike.${s},university_name.ilike.${s},organization.ilike.${s},role_title.ilike.${s})`;
      }

      const res = await fetch(url, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      if (!res.ok) {
        return new Response(`error: ${await res.text()}`, { status: 502, headers: corsHeaders });
      }

      const data = await res.json();
      return new Response(JSON.stringify({ data, hasMore: data.length === pageSize }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (type === 'messages') {
      let url = `${SUPABASE_URL}/rest/v1/contact_messages?select=*&order=created_at.desc&limit=${pageSize}&offset=${from}`;
      if (search && search.trim()) {
        const s = encodeURIComponent(`%${search.trim()}%`);
        url += `&or=(name.ilike.${s},email.ilike.${s},message.ilike.${s})`;
      }

      const res = await fetch(url, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      if (!res.ok) {
        return new Response(`error: ${await res.text()}`, { status: 502, headers: corsHeaders });
      }

      const data = await res.json();
      return new Response(JSON.stringify({ data, hasMore: data.length === pageSize }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (type === 'members') {
      let url = `${SUPABASE_URL}/rest/v1/members?select=*&order=created_at.desc&limit=${pageSize}&offset=${from}`;
      if (search && search.trim()) {
        const s = encodeURIComponent(`%${search.trim()}%`);
        url += `&or=(full_name.ilike.${s},email.ilike.${s},cohort.ilike.${s})`;
      }

      const res = await fetch(url, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      if (!res.ok) {
        return new Response(`error: ${await res.text()}`, { status: 502, headers: corsHeaders });
      }

      const data = await res.json();
      return new Response(JSON.stringify({ data, hasMore: data.length === pageSize }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (type === 'hackathon_registrations') {
      let url = `${SUPABASE_URL}/rest/v1/hackathon_registrations?select=*,members(full_name,email),events(title,start_date)&order=created_at.desc&limit=${pageSize}&offset=${from}`;
      if (status && status !== 'all') {
        url += `&status=eq.${status}`;
      }
      if (search && search.trim()) {
        const s = encodeURIComponent(`%${search.trim()}%`);
        url += `&or=(transaction_id.ilike.${s},members.full_name.ilike.${s},members.email.ilike.${s})`;
      }

      const res = await fetch(url, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      if (!res.ok) {
        return new Response(`error: ${await res.text()}`, { status: 502, headers: corsHeaders });
      }

      const data = await res.json();
      return new Response(JSON.stringify({ data, hasMore: data.length === pageSize }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (type === 'member_details') {
      const { member_id } = payload;
      if (!member_id) return new Response('Missing member_id', { status: 400, headers: corsHeaders });

      // Get member with all related data
      const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${member_id}&select=*`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      const memberData = memberRes.ok ? await memberRes.json() : [];
      const member = Array.isArray(memberData) && memberData[0] ? memberData[0] : null;
      if (!member) return new Response('Member not found', { status: 404, headers: corsHeaders });

      // Get event registrations
      const eventsRes = await fetch(`${SUPABASE_URL}/rest/v1/event_registrations?member_id=eq.${member_id}&select=*,events(title,event_type,start_date)`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      const events = eventsRes.ok ? await eventsRes.json() : [];

      // Get hackathon registrations
      const hackRes = await fetch(`${SUPABASE_URL}/rest/v1/hackathon_registrations?member_id=eq.${member_id}&select=*,events(title,start_date)`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      const hackathons = hackRes.ok ? await hackRes.json() : [];

      // Get teams where member is leader
      const leaderTeamsRes = await fetch(`${SUPABASE_URL}/rest/v1/hackathon_teams?team_leader_id=eq.${member_id}&select=*,team_members(member_id,role,members(full_name,email))`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      const leaderTeams = leaderTeamsRes.ok ? await leaderTeamsRes.json() : [];

      // Get teams where member is a member
      const memberTeamsRes = await fetch(`${SUPABASE_URL}/rest/v1/team_members?member_id=eq.${member_id}&select=team_id`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      const memberTeamIds = memberTeamsRes.ok ? await memberTeamsRes.json() : [];
      const teamIds = memberTeamIds.map((t: any) => t.team_id).filter((id: string) => 
        !leaderTeams.some((lt: any) => lt.id === id)
      );
      
      let memberTeams: any[] = [];
      if (teamIds.length > 0) {
        const idList = teamIds.map((id: string) => `"${id}"`).join(',');
        const memberTeamsRes2 = await fetch(`${SUPABASE_URL}/rest/v1/hackathon_teams?id=in.(${idList})&select=*,team_members(member_id,role,members(full_name,email))`, {
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
        });
        memberTeams = memberTeamsRes2.ok ? await memberTeamsRes2.json() : [];
      }
      
      const teams = [...leaderTeams, ...memberTeams];

      // Get activity
      const activityRes = await fetch(`${SUPABASE_URL}/rest/v1/member_activity?member_id=eq.${member_id}&order=created_at.desc&limit=50`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      const activity = activityRes.ok ? await activityRes.json() : [];

      return new Response(JSON.stringify({
        member,
        events,
        hackathons,
        teams,
        activity,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (type === 'participants') {
      const { hackathon_id } = payload;
      let url = `${SUPABASE_URL}/rest/v1/hackathon_registrations?select=*,members(full_name,email,created_at)&order=created_at.desc&limit=${pageSize}&offset=${from}`;
      if (hackathon_id) {
        url += `&hackathon_id=eq.${hackathon_id}`;
      }
      if (status && status !== 'all') {
        url += `&status=eq.${status}`;
      }

      const res = await fetch(url, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      if (!res.ok) {
        return new Response(`error: ${await res.text()}`, { status: 502, headers: corsHeaders });
      }

      const data = await res.json();
      return new Response(JSON.stringify({ data, hasMore: data.length === pageSize }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (type === 'events') {
      let url = `${SUPABASE_URL}/rest/v1/events?select=*,event_registrations(count)&order=start_date.desc`;
      if (search && search.trim()) {
        const s = encodeURIComponent(`%${search.trim()}%`);
        url += `&title.ilike.${s}`;
      }

      const res = await fetch(url, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      if (!res.ok) {
        return new Response(`error: ${await res.text()}`, { status: 502, headers: corsHeaders });
      }
      const data = await res.json();
      // Transform data to include registration count
      const transformed = Array.isArray(data) ? data.map((event: any) => ({
        ...event,
        registration_count: Array.isArray(event.event_registrations) ? event.event_registrations.length : (event.event_registrations?.[0]?.count || 0)
      })) : [];
      return new Response(JSON.stringify({ data: transformed }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (type === 'attendance_details') {
      const { event_id } = payload;
      if (!event_id) return new Response('Missing event_id', { status: 400, headers: corsHeaders });

      const eventRes = await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${event_id}&select=id,title,start_date,event_type,is_member_only,location,description`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      const eventRows = eventRes.ok ? await eventRes.json() : [];
      const event = Array.isArray(eventRows) && eventRows[0] ? eventRows[0] : null;
      if (!event) return new Response('Event not found', { status: 404, headers: corsHeaders });

      const registrationsRes = await fetch(`${SUPABASE_URL}/rest/v1/event_registrations?event_id=eq.${event_id}&select=*,members(full_name,email,secret_code,status)&order=created_at.asc`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      const registrations = registrationsRes.ok ? await registrationsRes.json() : [];

      const checkinsRes = await fetch(`${SUPABASE_URL}/rest/v1/event_checkins?event_id=eq.${event_id}&select=*,members(full_name,email,secret_code)&order=created_at.desc`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      const checkins = checkinsRes.ok ? await checkinsRes.json() : [];

      return new Response(JSON.stringify({ event, registrations, checkins }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response('Invalid type', { status: 400, headers: corsHeaders });
    }
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, {
      status: 400,
      headers: corsHeaders,
    });
  }
});

