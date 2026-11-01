/**
 * Single-admin auth: a password from ADMIN_PASSWORD and an HMAC-signed,
 * expiring session cookie. Web Crypto only, so it runs in the proxy and in actions.
 */
export const SESSION_COOKIE = "sd_admin";
const SESSION_TTL_S = 60 * 60 * 24 * 7;

export function adminPassword(): string | null {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  return process.env.NODE_ENV === "production" ? null : "admin";
}

function secret() {
  return process.env.ADMIN_SECRET ?? `sd:${adminPassword() ?? ""}`;
}

const enc = new TextEncoder();

async function hmac(data: string, key = secret()) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(data));
  return Buffer.from(sig).toString("base64url");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(input: string) {
  const expected = adminPassword();
  if (!expected) return false;
  // Compare digests so timing doesn't leak the password length or prefix.
  return safeEqual(await hmac(input, "pw"), await hmac(expected, "pw"));
}

export async function createSessionToken() {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  return { token: `${exp}.${await hmac(String(exp))}`, maxAge: SESSION_TTL_S };
}

export async function verifySessionToken(token: string | undefined) {
  if (!token || !adminPassword()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmac(exp));
}
