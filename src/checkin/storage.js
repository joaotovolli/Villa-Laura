import { randomBytes, randomUUID } from "node:crypto";

const localRoot = ".local-data/checkins";
const makeId = () => {
  if (typeof randomUUID === "function") return randomUUID();
  return randomBytes(16).toString("hex");
};

const localFs = async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  return { fs, path };
};

const jsonResponse = (value) => JSON.stringify(value, null, 2);

export class CheckinStorage {
  constructor(env = {}) {
    this.bucket = env.VILLA_LAURA_CHECKINS;
    this.env = env;
  }

  async getJson(key, fallback = null) {
    if (this.bucket) {
      const object = await this.bucket.get(key);
      return object ? object.json() : fallback;
    }
    const { fs, path } = await localFs();
    try {
      const text = await fs.readFile(path.join(process.cwd(), localRoot, key), "utf8");
      return JSON.parse(text);
    } catch (error) {
      if (error.code === "ENOENT") return fallback;
      throw error;
    }
  }

  async putJson(key, value) {
    if (this.bucket) {
      await this.bucket.put(key, jsonResponse(value), { httpMetadata: { contentType: "application/json" } });
      return;
    }
    const { fs, path } = await localFs();
    const target = path.join(process.cwd(), localRoot, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, jsonResponse(value));
  }

  async putBytes(key, value, contentType = "application/octet-stream") {
    if (this.bucket) {
      await this.bucket.put(key, value, { httpMetadata: { contentType } });
      return;
    }
    const { fs, path } = await localFs();
    const target = path.join(process.cwd(), localRoot, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const buffer = value instanceof ArrayBuffer ? Buffer.from(value) : Buffer.from(await value.arrayBuffer());
    await fs.writeFile(target, buffer);
  }

  async getObject(key) {
    if (this.bucket) {
      return this.bucket.get(key);
    }
    const { fs, path } = await localFs();
    try {
      const bytes = await fs.readFile(path.join(process.cwd(), localRoot, key));
      return {
        body: bytes,
        httpMetadata: { contentType: "application/octet-stream" },
        writeHttpMetadata(headers) {
          headers.set("content-type", "application/octet-stream");
        }
      };
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key) {
    if (this.bucket) {
      await this.bucket.delete(key);
      return;
    }
    const { fs, path } = await localFs();
    await fs.rm(path.join(process.cwd(), localRoot, key), { force: true });
  }

  async listJson(prefix) {
    if (this.bucket) {
      const list = await this.bucket.list({ prefix });
      const jsonObjects = list.objects.filter((object) => object.key.endsWith(".json"));
      return Promise.all(jsonObjects.map((object) => this.getJson(object.key)));
    }
    const { fs, path } = await localFs();
    const dir = path.join(process.cwd(), localRoot, prefix);
    const output = [];
    const walk = async (current) => {
      let entries = [];
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
      }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) await walk(full);
        if (entry.isFile() && entry.name.endsWith(".json")) output.push(JSON.parse(await fs.readFile(full, "utf8")));
      }
    };
    await walk(dir);
    return output;
  }

  async audit(event) {
    const now = new Date().toISOString();
    const date = now.slice(0, 10);
    const id = makeId();
    const safe = {
      id,
      at: now,
      type: event.type,
      actor: event.actor || "system",
      reservationUid: event.reservationUid || "",
      tokenId: event.tokenId || "",
      details: event.details || {}
    };
    await this.putJson(`checkins/audit/${date}/${id}.json`, safe);
  }
}

export const keys = {
  reservation: (uid) => `checkins/reservations/${encodeURIComponent(uid)}.json`,
  token: (token) => `checkins/tokens/${encodeURIComponent(token)}.json`,
  submission: (token) => `checkins/submissions/${encodeURIComponent(token)}/submission.json`,
  document: (token, guestId, filename) =>
    `checkins/submissions/${encodeURIComponent(token)}/documents/${encodeURIComponent(guestId)}/${encodeURIComponent(filename)}`
};
