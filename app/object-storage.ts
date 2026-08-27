import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSiteRuntimeBindings, type LegacyObjectStorage } from "./runtime-bindings";

type StoredObject = {
  body: BodyInit;
  writeHttpMetadata(headers: Headers): void;
};

type ObjectStorage = {
  get(key: string): Promise<StoredObject | null>;
  put(
    key: string,
    value: unknown,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<void>;
  delete(key: string | string[]): Promise<void>;
};

type StorageGlobal = typeof globalThis & {
  __ALLO_TCHAD_SUPABASE__?: SupabaseClient;
};

function getSupabaseAdminClient() {
  const runtime = globalThis as StorageGlobal;
  if (runtime.__ALLO_TCHAD_SUPABASE__) return runtime.__ALLO_TCHAD_SUPABASE__;

  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return null;

  runtime.__ALLO_TCHAD_SUPABASE__ = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return runtime.__ALLO_TCHAD_SUPABASE__;
}

async function normalizeUpload(value: unknown): Promise<Blob | ArrayBuffer | Uint8Array<ArrayBuffer>> {
  if (value instanceof Blob || value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    const copy = new Uint8Array(value.byteLength);
    copy.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    return copy;
  }
  if (value instanceof ReadableStream) return new Response(value).arrayBuffer();
  throw new Error("Format de fichier non pris en charge.");
}

function supabaseStorage(client: SupabaseClient): ObjectStorage {
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "allo-tchad-media";
  const bucket = client.storage.from(bucketName);

  return {
    async get(key) {
      const { data, error } = await bucket.download(key);
      if (error) {
        if (/not found|does not exist/i.test(error.message)) return null;
        throw error;
      }
      return {
        body: data,
        writeHttpMetadata(headers) {
          headers.set("Content-Type", data.type || "application/octet-stream");
          headers.set("X-Content-Type-Options", "nosniff");
        },
      };
    },
    async put(key, value, options) {
      const { error } = await bucket.upload(key, await normalizeUpload(value), {
        contentType: options?.httpMetadata?.contentType,
        upsert: true,
      });
      if (error) throw error;
    },
    async delete(key) {
      const { error } = await bucket.remove(Array.isArray(key) ? key : [key]);
      if (error) throw error;
    },
  };
}

function r2Storage(bucket: LegacyObjectStorage): ObjectStorage {
  return {
    async get(key) {
      const object = await bucket.get(key);
      if (!object) return null;
      return {
        body: object.body,
        writeHttpMetadata(headers) {
          object.writeHttpMetadata(headers);
          headers.set("X-Content-Type-Options", "nosniff");
        },
      };
    },
    async put(key, value, options) {
      await bucket.put(key, value, options);
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}

export function getObjectStorage(): ObjectStorage | null {
  const r2 = getSiteRuntimeBindings().BUCKET;
  if (r2) return r2Storage(r2);
  const supabase = getSupabaseAdminClient();
  return supabase ? supabaseStorage(supabase) : null;
}
