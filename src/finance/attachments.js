import { sanitizeFilename } from "../checkin/security.js";
import { webcrypto as nodeWebcrypto } from "node:crypto";

const cryptoImpl = globalThis.crypto || nodeWebcrypto;

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_RECORD = 20;
export const MAX_ACTIVE_ATTACHMENT_BYTES = 1024 * 1024 * 1024;
export const MAX_FINANCE_CLASS_A_PER_MONTH = 100_000;
export const MAX_FINANCE_CLASS_B_PER_MONTH = 1_000_000;

const types = Object.freeze({
  "application/pdf": { extensions: new Set(["pdf"]), signature: (b) => b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-" },
  "image/jpeg": { extensions: new Set(["jpg", "jpeg"]), signature: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { extensions: new Set(["png"]), signature: (b) => b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v) },
  "image/webp": { extensions: new Set(["webp"]), signature: (b) => b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP" }
});

export class AttachmentValidationError extends Error {
  constructor(message, code = "invalid_attachment", status = 400) {
    super(message);
    this.name = "AttachmentValidationError";
    this.code = code;
    this.status = status;
  }
}

const hex = (buffer) => [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");
const cleanOriginalFilename = (name) => String(name || "evidence")
  .replace(/[\u0000-\u001f\u007f]/g, "")
  .trim()
  .slice(0, 180) || "evidence";

export const validateAttachmentFile = async (file) => {
  if (!file || typeof file.arrayBuffer !== "function") throw new AttachmentValidationError("Choose a file to upload", "missing_file");
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new AttachmentValidationError("The attachment must not be empty", "empty_file");
  if (file.size > MAX_ATTACHMENT_BYTES) throw new AttachmentValidationError("The attachment exceeds the 10 MB limit", "file_too_large", 413);
  const originalFilename = cleanOriginalFilename(file.name);
  const extension = originalFilename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
  const mimeType = String(file.type || "").toLowerCase();
  const rule = types[mimeType];
  if (!rule || !rule.extensions.has(extension)) throw new AttachmentValidationError("Only PDF, JPEG, PNG, and WebP evidence files are supported", "unsupported_file_type");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!rule.signature(bytes)) throw new AttachmentValidationError("The file contents do not match its type and extension", "signature_mismatch");
  const checksum = hex(await cryptoImpl.subtle.digest("SHA-256", bytes));
  const displayFilename = sanitizeFilename(originalFilename).slice(0, 120);
  return { bytes, originalFilename, displayFilename, extension, mimeType, sizeBytes: bytes.byteLength, checksum };
};

export const financeObjectPrefix = ({ request, env }) => {
  const host = new URL(request.url).hostname.toLowerCase();
  let productionHost = "villa-laura.it";
  try { productionHost = new URL(env.VILLA_LAURA_SITE_URL || "https://villa-laura.it").hostname.toLowerCase(); } catch { /* safe default */ }
  const namespace = env.APP_ENV === "production" && host === productionHost ? "production" : "preview";
  return `finance/evidence/${namespace}/`;
};

export const financeObjectKey = ({ request, env, parentType, parentId, attachmentId }) => {
  const segment = parentType === "expense" ? "expenses" : "payments";
  return `${financeObjectPrefix({ request, env })}${segment}/${encodeURIComponent(parentId)}/${encodeURIComponent(attachmentId)}`;
};

export const contentDisposition = (filename, download = false) => {
  const safe = sanitizeFilename(filename).replace(/["\\\r\n]/g, "-") || "evidence";
  const encoded = encodeURIComponent(safe).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${download ? "attachment" : "inline"}; filename="${safe}"; filename*=UTF-8''${encoded}`;
};

export const publicAttachment = (attachment) => ({
  id: attachment.id,
  parentType: attachment.parentType,
  parentId: attachment.parentId,
  filename: attachment.displayFilename,
  mimeType: attachment.mimeType,
  extension: attachment.extension,
  sizeBytes: attachment.sizeBytes,
  checksum: attachment.checksum,
  description: attachment.description,
  status: attachment.status,
  uploadedBy: attachment.uploadedBy,
  uploadedAt: attachment.uploadedAt,
  updatedAt: attachment.updatedAt
});
