export type LegacyObjectStorage = {
  get(key: string): Promise<{
    body: ReadableStream;
    writeHttpMetadata(headers: Headers): void;
  } | null>;
  put(key: string, value: unknown, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(key: string | string[]): Promise<unknown>;
};

export type SiteRuntimeBindings = {
  BUCKET?: LegacyObjectStorage;
  ADMIN_EMAILS?: string;
};

type RuntimeGlobal = typeof globalThis & {
  __ALLO_TCHAD_BINDINGS__?: SiteRuntimeBindings;
};

export function setSiteRuntimeBindings(bindings: SiteRuntimeBindings) {
  (globalThis as RuntimeGlobal).__ALLO_TCHAD_BINDINGS__ = bindings;
}

export function getSiteRuntimeBindings(): SiteRuntimeBindings {
  return (globalThis as RuntimeGlobal).__ALLO_TCHAD_BINDINGS__ ?? {};
}
