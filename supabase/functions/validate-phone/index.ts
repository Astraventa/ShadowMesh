import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const RAPIDAPI_PHONE_HOST = "number-validator1.p.rapidapi.com";
const RAPIDAPI_PHONE_ENDPOINT = `https://${RAPIDAPI_PHONE_HOST}/NumberVerificationValidate`;
const rapidApiKey = Deno.env.get("RAPIDAPI_KEY") ?? "";

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizePhone(input: string): string {
  return input.replace(/[^\d+]/g, "");
}

function looksLikeE164(input: string) {
  return /^\+[1-9][0-9]{6,14}$/.test(input);
}

async function verifyWithRapidApi(phone: string) {
  if (!rapidApiKey) {
    return { status: "unavailable" as const };
  }
  try {
    const payload = JSON.stringify({ number: phone.startsWith("+") ? phone.slice(1) : phone });
    const res = await fetch(RAPIDAPI_PHONE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-key": rapidApiKey,
        "x-rapidapi-host": RAPIDAPI_PHONE_HOST,
      },
      body: payload,
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("RapidAPI phone validator error", res.status, text);
      return { status: "error" as const };
    }
    const data = await res.json();
    const validValue = data?.valid ?? data?.status;
    const valid =
      typeof validValue === "boolean"
        ? validValue
        : typeof validValue === "string"
        ? validValue.toLowerCase() === "true" || validValue.toLowerCase() === "valid"
        : false;
    return { status: "ok" as const, valid, raw: data };
  } catch (error) {
    console.error("RapidAPI phone validator threw", error);
    return { status: "error" as const };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return ok({ error: "Method not allowed" }, 405);
  }

  let phone: string | undefined;
  try {
    const payload = await req.json();
    phone = typeof payload?.phone === "string" ? normalizePhone(payload.phone.trim()) : undefined;
  } catch (_) {
    return ok({ error: "Invalid body" }, 400);
  }

  if (!phone) {
    return ok({ error: "Phone required" }, 400);
  }

  if (!looksLikeE164(phone)) {
    return ok({ valid: false, reason: "format" }, 200);
  }

  const rapidResult = await verifyWithRapidApi(phone);
  if (rapidResult.status === "ok") {
    if (!rapidResult.valid) {
      return ok({ valid: false, reason: "api", details: rapidResult.raw ?? null }, 200);
    }
    return ok({ valid: true, details: rapidResult.raw ?? null }, 200);
  }

  // Fallback: basic pattern already validated, so accept but mark as unverified
  return ok({ valid: true, reason: "fallback" }, 200);
});

