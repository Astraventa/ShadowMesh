import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const RAPIDAPI_EMAIL_HOST = "email-verifier15.p.rapidapi.com";
const RAPIDAPI_EMAIL_ENDPOINT = `https://${RAPIDAPI_EMAIL_HOST}/verify-email`;
const rapidApiKey = Deno.env.get("RAPIDAPI_KEY") ?? "";

// Local disposable domains blacklist file (copied from supabase/assets)
const DISPOSABLE_DOMAINS_FILE = "./disposable-email-domains.txt";

let disposableDomainsPromise: Promise<Set<string>> | null = null;

async function loadDisposableDomains(): Promise<Set<string>> {
  if (!disposableDomainsPromise) {
    disposableDomainsPromise = (async () => {
      try {
        // Read from local file instead of fetching from GitHub
        const text = await Deno.readTextFile(DISPOSABLE_DOMAINS_FILE);
        const domains = text
          .split("\n")
          .map((d) => d.trim().toLowerCase())
          .filter((d) => d.length > 0 && !d.startsWith("#"));
        console.log(`Loaded ${domains.length} disposable email domains from local file`);
        return new Set(domains);
      } catch (error) {
        console.error("Failed to load disposable domain list from local file", error);
        // Fallback: return empty set (validation will still work via API and MX checks)
        return new Set();
      }
    })();
  }
  return disposableDomainsPromise;
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function verifyWithRapidApi(email: string) {
  if (!rapidApiKey) {
    return { status: "unavailable" as const };
  }
  try {
    const url = `${RAPIDAPI_EMAIL_ENDPOINT}?email=${encodeURIComponent(email)}`;
    const res = await fetch(url, {
      headers: {
        "x-rapidapi-key": rapidApiKey,
        "x-rapidapi-host": RAPIDAPI_EMAIL_HOST,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("RapidAPI email verifier error", res.status, text);
      return { status: "error" as const };
    }
    const data = await res.json();
    const valid = typeof data.valid === "boolean" ? data.valid : data?.status === "valid";
    const disposable = typeof data.disposable === "boolean"
      ? data.disposable
      : Boolean(
          data?.validators?.disposable?.valid === false ||
            data?.validators?.disposable?.reason === "disposable",
        );
    return {
      status: "ok" as const,
      valid,
      disposable,
      raw: data,
    };
  } catch (error) {
    console.error("RapidAPI email verifier threw", error);
    return { status: "error" as const };
  }
}

async function lookupMx(domain: string) {
  try {
    const records = await Deno.resolveDns(domain, "MX");
    return Array.isArray(records) && records.length > 0;
  } catch (err) {
    console.warn("MX lookup failed", domain, err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return ok({ error: "Method not allowed" }, 405);
  }

  let email: string | undefined;
  try {
    const payload = await req.json();
    email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : undefined;
  } catch (_) {
    return ok({ error: "Invalid body" }, 400);
  }

  if (!email) {
    return ok({ error: "Email required" }, 400);
  }

  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailRegex.test(email)) {
    return ok({ valid: false, reason: "syntax" }, 200);
  }

  const domain = email.split("@").pop()!;
  const disposableDomains = await loadDisposableDomains();
  if (disposableDomains.has(domain)) {
    return ok({ valid: false, reason: "disposable" }, 200);
  }

  const rapidResult = await verifyWithRapidApi(email);
  if (rapidResult.status === "ok") {
    if (!rapidResult.valid) {
      return ok({ valid: false, reason: "smtp", details: rapidResult.raw ?? null }, 200);
    }
    if (rapidResult.disposable) {
      return ok({ valid: false, reason: "disposable", details: rapidResult.raw ?? null }, 200);
    }
  }

  const mxOk = await lookupMx(domain);
  if (!mxOk) {
    return ok({ valid: false, reason: "no_mx" }, 200);
  }

  return ok({ valid: true });
});

