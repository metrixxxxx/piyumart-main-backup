// Synthetic photo and in-memory Storage for financial lifecycle tests.
import assert from "node:assert/strict";

export function proofPhoto() {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1kAAAAASUVORK5CYII=", "base64");
  return new File([png], "received.png", { type: "image/png" });
}

export function withProofStorage(options) {
  const objects = new Map();
  return {
    ...options,
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://storage.example", SUPABASE_SERVICE_ROLE_KEY: "fixture", ...options.env },
    moduleMocks: {
      "@supabase/supabase-js": { createClient: () => ({ storage: { from: bucket => {
        assert.equal(bucket, "pickup-proofs");
        return {
          upload: async (path, bytes, settings) => {
            assert.equal(settings.upsert, false); assert.ok(!objects.has(path)); objects.set(path, bytes); return {};
          },
          remove: async paths => { for (const path of paths) objects.delete(path); return {}; },
        };
      } } }) },
      ...options.moduleMocks,
    },
  };
}
