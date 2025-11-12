import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const RAPIDAPI_PHONE_HOST_PRIMARY = "phone-validator-api-apiverve.p.rapidapi.com";
const RAPIDAPI_PHONE_ENDPOINT_PRIMARY = `https://${RAPIDAPI_PHONE_HOST_PRIMARY}/v1/phonenumbervalidator`;
const RAPIDAPI_PHONE_HOST_SECONDARY = "number-validator1.p.rapidapi.com";
const RAPIDAPI_PHONE_ENDPOINT_SECONDARY = `https://${RAPIDAPI_PHONE_HOST_SECONDARY}/NumberVerificationValidate`;
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

type CountryGuess = {
  iso: string | null;
  national: string;
};

const CALLING_CODES: Array<{ code: string; iso: string }> = [
  { code: "971", iso: "ae" },
  { code: "970", iso: "ps" },
  { code: "966", iso: "sa" },
  { code: "965", iso: "kw" },
  { code: "964", iso: "iq" },
  { code: "963", iso: "sy" },
  { code: "962", iso: "jo" },
  { code: "961", iso: "lb" },
  { code: "960", iso: "mv" },
  { code: "998", iso: "uz" },
  { code: "997", iso: "kz" }, // shared, best-effort
  { code: "996", iso: "kg" },
  { code: "995", iso: "ge" },
  { code: "994", iso: "az" },
  { code: "993", iso: "tm" },
  { code: "992", iso: "tj" },
  { code: "977", iso: "np" },
  { code: "976", iso: "mn" },
  { code: "975", iso: "bt" },
  { code: "974", iso: "qa" },
  { code: "973", iso: "bh" },
  { code: "972", iso: "il" },
  { code: "962", iso: "jo" },
  { code: "961", iso: "lb" },
  { code: "960", iso: "mv" },
  { code: "855", iso: "kh" },
  { code: "856", iso: "la" },
  { code: "853", iso: "mo" },
  { code: "852", iso: "hk" },
  { code: "850", iso: "kp" },
  { code: "821", iso: "kr" },
  { code: "818", iso: "eg" },
  { code: "818", iso: "eg" },
  { code: "886", iso: "tw" },
  { code: "880", iso: "bd" },
  { code: "878", iso: "xx" }, // placeholder
  { code: "876", iso: "jm" },
  { code: "875", iso: "xx" },
  { code: "874", iso: "xx" },
  { code: "873", iso: "xx" },
  { code: "872", iso: "xx" },
  { code: "871", iso: "xx" },
  { code: "870", iso: "xx" },
  { code: "869", iso: "kn" },
  { code: "868", iso: "tt" },
  { code: "867", iso: "xx" },
  { code: "866", iso: "xx" },
  { code: "865", iso: "xx" },
  { code: "864", iso: "xx" },
  { code: "863", iso: "xx" },
  { code: "862", iso: "xx" },
  { code: "861", iso: "xx" },
  { code: "860", iso: "xx" },
  { code: "859", iso: "xx" },
  { code: "858", iso: "xx" },
  { code: "857", iso: "xx" },
  { code: "856", iso: "la" },
  { code: "855", iso: "kh" },
  { code: "854", iso: "xx" },
  { code: "853", iso: "mo" },
  { code: "852", iso: "hk" },
  { code: "851", iso: "xx" },
  { code: "850", iso: "kp" },
  { code: "509", iso: "ht" },
  { code: "507", iso: "pa" },
  { code: "506", iso: "cr" },
  { code: "505", iso: "ni" },
  { code: "504", iso: "hn" },
  { code: "503", iso: "sv" },
  { code: "502", iso: "gt" },
  { code: "501", iso: "bz" },
  { code: "423", iso: "li" },
  { code: "420", iso: "cz" },
  { code: "389", iso: "mk" },
  { code: "387", iso: "ba" },
  { code: "386", iso: "si" },
  { code: "385", iso: "hr" },
  { code: "383", iso: "xk" },
  { code: "381", iso: "rs" },
  { code: "380", iso: "ua" },
  { code: "378", iso: "sm" },
  { code: "377", iso: "mc" },
  { code: "376", iso: "ad" },
  { code: "375", iso: "by" },
  { code: "374", iso: "am" },
  { code: "373", iso: "md" },
  { code: "372", iso: "ee" },
  { code: "371", iso: "lv" },
  { code: "370", iso: "lt" },
  { code: "359", iso: "bg" },
  { code: "358", iso: "fi" },
  { code: "357", iso: "cy" },
  { code: "356", iso: "mt" },
  { code: "355", iso: "al" },
  { code: "354", iso: "is" },
  { code: "353", iso: "ie" },
  { code: "352", iso: "lu" },
  { code: "351", iso: "pt" },
  { code: "350", iso: "gi" },
  { code: "98", iso: "ir" },
  { code: "97", iso: "xx" },
  { code: "94", iso: "lk" },
  { code: "93", iso: "af" },
  { code: "92", iso: "pk" },
  { code: "91", iso: "in" },
  { code: "90", iso: "tr" },
  { code: "86", iso: "cn" },
  { code: "84", iso: "vn" },
  { code: "82", iso: "kr" },
  { code: "81", iso: "jp" },
  { code: "66", iso: "th" },
  { code: "65", iso: "sg" },
  { code: "64", iso: "nz" },
  { code: "63", iso: "ph" },
  { code: "62", iso: "id" },
  { code: "61", iso: "au" },
  { code: "60", iso: "my" },
  { code: "58", iso: "ve" },
  { code: "57", iso: "co" },
  { code: "56", iso: "cl" },
  { code: "55", iso: "br" },
  { code: "54", iso: "ar" },
  { code: "53", iso: "cu" },
  { code: "52", iso: "mx" },
  { code: "51", iso: "pe" },
  { code: "49", iso: "de" },
  { code: "48", iso: "pl" },
  { code: "47", iso: "no" },
  { code: "46", iso: "se" },
  { code: "45", iso: "dk" },
  { code: "44", iso: "gb" },
  { code: "43", iso: "at" },
  { code: "41", iso: "ch" },
  { code: "40", iso: "ro" },
  { code: "39", iso: "it" },
  { code: "38", iso: "xx" },
  { code: "37", iso: "xx" },
  { code: "36", iso: "hu" },
  { code: "34", iso: "es" },
  { code: "33", iso: "fr" },
  { code: "32", iso: "be" },
  { code: "31", iso: "nl" },
  { code: "30", iso: "gr" },
  { code: "27", iso: "za" },
  { code: "20", iso: "eg" },
  { code: "7", iso: "ru" },
  { code: "6", iso: "xx" },
  { code: "5", iso: "xx" },
  { code: "4", iso: "xx" },
  { code: "3", iso: "xx" },
  { code: "2", iso: "xx" },
  { code: "1", iso: "us" },
];

CALLING_CODES.sort((a, b) => b.code.length - a.code.length);

function guessCountry(phone: string): CountryGuess {
  const digits = phone.startsWith("+") ? phone.slice(1) : phone;
  let match: { code: string; iso: string } | null = null;
  for (const entry of CALLING_CODES) {
    if (digits.startsWith(entry.code)) {
      match = entry;
      break;
    }
  }
  if (!match) {
    return { iso: null, national: digits };
  }
  const national = digits.slice(match.code.length) || digits;
  return { iso: match.iso === "xx" ? null : match.iso, national };
}

async function verifyWithApiverve(phone: string) {
  if (!rapidApiKey) {
    return { status: "unavailable" as const };
  }
  const guess = guessCountry(phone);
  if (!guess.iso || !guess.national) {
    return { status: "skip" as const };
  }
  try {
    const url = `${RAPIDAPI_PHONE_ENDPOINT_PRIMARY}?number=${encodeURIComponent(guess.national)}&country=${encodeURIComponent(guess.iso)}`;
    const res = await fetch(url, {
      headers: {
        "x-rapidapi-key": rapidApiKey,
        "x-rapidapi-host": RAPIDAPI_PHONE_HOST_PRIMARY,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("Apiverve phone validator error", res.status, text);
      return { status: "error" as const, guess };
    }
    const data = await res.json();
    const boolCandidates = [
      data?.valid,
      data?.status,
      data?.isValid,
      data?.is_valid,
      data?.data?.valid,
      data?.data?.isValid,
      data?.result?.valid,
    ];
    const valid = boolCandidates.some((v) => v === true);
    const invalid = boolCandidates.some((v) => v === false);
    return {
      status: "ok" as const,
      valid: valid && !invalid,
      invalid: invalid,
      guess,
      raw: data,
    };
  } catch (error) {
    console.error("Apiverve phone validator threw", error);
    return { status: "error" as const, guess };
  }
}

async function verifyWithRapidApi(phone: string) {
  if (!rapidApiKey) {
    return { status: "unavailable" as const };
  }
  try {
    const payload = JSON.stringify({ number: phone.startsWith("+") ? phone.slice(1) : phone });
    const res = await fetch(RAPIDAPI_PHONE_ENDPOINT_SECONDARY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-key": rapidApiKey,
        "x-rapidapi-host": RAPIDAPI_PHONE_HOST_SECONDARY,
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

  const apiverveResult = await verifyWithApiverve(phone);
  const secondaryResult = await verifyWithRapidApi(phone);

  const primaryGuess = (apiverveResult as { guess?: CountryGuess } | undefined)?.guess;
  const guess = primaryGuess ?? guessCountry(phone);
  const detectedCountry = guess.iso ? guess.iso.toUpperCase() : null;

  if (apiverveResult.status === "ok" && apiverveResult.valid) {
    return ok({ valid: true, status: "ok", country: detectedCountry }, 200);
  }

  if (secondaryResult.status === "ok" && secondaryResult.valid) {
    return ok({ valid: true, status: "ok", country: detectedCountry }, 200);
  }

  const warningReason =
    (apiverveResult.status === "ok" && apiverveResult.invalid) || (secondaryResult.status === "ok" && secondaryResult.valid === false)
      ? "api_invalid"
      : "api_unverified";

  return ok(
    {
      valid: true,
      status: "warning",
      reason: warningReason,
      country: detectedCountry,
    },
    200,
  );
});

