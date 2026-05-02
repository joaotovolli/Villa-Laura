import { webcrypto as nodeWebcrypto, randomBytes } from "node:crypto";

const cryptoImpl = globalThis.crypto || nodeWebcrypto;
const encoder = new TextEncoder();

export const base64url = (input) => {
  const bytes = input instanceof Uint8Array ? input : encoder.encode(String(input));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const randomToken = (prefix = "vl") => {
  const bytes = new Uint8Array(32);
  if (cryptoImpl?.getRandomValues) {
    cryptoImpl.getRandomValues(bytes);
  } else {
    bytes.set(randomBytes(32));
  }
  return `${prefix}_${base64url(bytes)}`;
};

const importKey = (secret) =>
  cryptoImpl.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export const signValue = async (value, secret) => {
  const key = await importKey(secret);
  const signature = await cryptoImpl.subtle.sign("HMAC", key, encoder.encode(value));
  return `${value}.${base64url(new Uint8Array(signature))}`;
};

export const verifySignedValue = async (signed, secret) => {
  const splitAt = String(signed || "").lastIndexOf(".");
  if (splitAt < 1) return "";
  const value = signed.slice(0, splitAt);
  const expected = await signValue(value, secret);
  return timingSafeEqual(expected, signed) ? value : "";
};

const timingSafeEqual = (left, right) => {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
};

export const sanitizeFilename = (name) => {
  const cleaned = String(name || "document")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/\.\.+/g, ".")
    .replace(/-+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 80);
  return cleaned || "document";
};

export const allowedDocumentType = (file) => {
  const allowed = new Map([
    ["application/pdf", ".pdf"],
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/webp", ".webp"]
  ]);
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return allowed.has(type) && name.endsWith(allowed.get(type));
};
