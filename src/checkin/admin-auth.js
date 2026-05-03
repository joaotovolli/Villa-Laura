const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
const ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const base64urlToBytes = (value) => {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const decodeJwtPart = (value) => JSON.parse(decoder.decode(base64urlToBytes(value)));

export const parseAllowedAdminEmails = (env = {}) => {
  return String(env.ALLOWED_ADMIN_EMAILS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
};

export const isProduction = (env = {}) => String(env.APP_ENV || "").toLowerCase() === "production";

export const isEmailAllowed = (email, env = {}) => {
  const normalized = String(email || "").trim().toLowerCase();
  return Boolean(normalized) && parseAllowedAdminEmails(env).includes(normalized);
};

export const parseAccessJwt = (jwt) => {
  const parts = String(jwt || "").split(".");
  if (parts.length !== 3) return null;
  return {
    header: decodeJwtPart(parts[0]),
    payload: decodeJwtPart(parts[1]),
    signingInput: encoder.encode(`${parts[0]}.${parts[1]}`),
    signature: base64urlToBytes(parts[2])
  };
};

const normalizeTeamDomain = (value) =>
  String(value || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

const jwtIssuerAllowed = (issuer, teamDomain) => {
  const normalizedTeam = normalizeTeamDomain(teamDomain);
  if (!normalizedTeam) return false;
  return String(issuer || "").replace(/\/+$/, "") === `https://${normalizedTeam}`;
};

const jwtAudienceAllowed = (audience, configuredAudience) => {
  if (!configuredAudience) return false;
  const allowed = String(configuredAudience)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const values = Array.isArray(audience) ? audience : [audience];
  return values.some((value) => allowed.includes(value));
};

const jwtNotExpired = (payload, nowSeconds = Date.now() / 1000) =>
  Number(payload?.exp || 0) > nowSeconds && Number(payload?.nbf || 0) <= nowSeconds + 60;

const importRsaPublicKey = (jwk) =>
  crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);

export const verifyCloudflareAccessJwt = async (jwt, env = {}) => {
  const teamDomain = normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  const audience = env.CF_ACCESS_AUD;
  if (!teamDomain || !audience) return { ok: false, reason: "missing_config" };

  let parsed;
  try {
    parsed = parseAccessJwt(jwt);
  } catch {
    return { ok: false, reason: "invalid_jwt" };
  }
  if (!parsed?.header?.kid || parsed.header.alg !== "RS256") return { ok: false, reason: "invalid_header" };
  if (!jwtIssuerAllowed(parsed.payload.iss, teamDomain)) return { ok: false, reason: "invalid_issuer" };
  if (!jwtAudienceAllowed(parsed.payload.aud, audience)) return { ok: false, reason: "invalid_audience" };
  if (!jwtNotExpired(parsed.payload)) return { ok: false, reason: "expired" };

  const certsResponse = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!certsResponse.ok) return { ok: false, reason: "certs_unavailable" };
  const certs = await certsResponse.json();
  const jwk = certs.keys?.find((key) => key.kid === parsed.header.kid);
  if (!jwk) return { ok: false, reason: "key_not_found" };
  const key = await importRsaPublicKey(jwk);
  const validSignature = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, parsed.signature, parsed.signingInput);
  return validSignature ? { ok: true, payload: parsed.payload } : { ok: false, reason: "bad_signature" };
};

export const getCloudflareAccessIdentity = async (request, env = {}) => {
  const jwt = request.headers.get(ACCESS_JWT_HEADER);
  const headerEmail = request.headers.get(ACCESS_EMAIL_HEADER);
  const hasStrictJwtConfig = Boolean(env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD);

  if (jwt && hasStrictJwtConfig) {
    const verified = await verifyCloudflareAccessJwt(jwt, env);
    if (!verified.ok) {
      return isEmailAllowed(headerEmail, env) ? { email: headerEmail, method: "cloudflare_access_header" } : null;
    }
    const email = verified.payload.email || verified.payload.common_name || headerEmail;
    return isEmailAllowed(email, env) ? { email, method: "cloudflare_access_jwt" } : null;
  }

  if (jwt) {
    try {
      const parsed = parseAccessJwt(jwt);
      const email = parsed?.payload?.email || parsed?.payload?.common_name || headerEmail;
      if (isEmailAllowed(email, env)) {
        return { email, method: "cloudflare_access_edge" };
      }
    } catch {
      return null;
    }
  }

  if (isEmailAllowed(headerEmail, env)) {
    return { email: headerEmail, method: "cloudflare_access_header" };
  }

  return null;
};

export const passwordFallbackEnabled = (env = {}) => !isProduction(env);
