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

export const randomId = () => {
  if (cryptoImpl?.randomUUID) return cryptoImpl.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoImpl?.getRandomValues) cryptoImpl.getRandomValues(bytes);
  else bytes.set(randomBytes(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  const extension = name.match(/\.([a-z0-9]+)$/)?.[1] || "";
  const allowed = {
    "application/pdf": new Set(["pdf"]),
    "image/jpeg": new Set(["jpg", "jpeg"]),
    "image/pjpeg": new Set(["jpg", "jpeg"]),
    "image/png": new Set(["png"]),
    "image/webp": new Set(["webp"])
  };
  return Boolean(allowed[type]?.has(extension));
};
