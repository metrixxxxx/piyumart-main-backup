// Explicit opt-in. Uploads one synthetic image and removes that exact object.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

if (process.env.PIYUMART_PICKUP_STORAGE_TEST !== "1") {
  console.log("Set PIYUMART_PICKUP_STORAGE_TEST=1 to verify private pickup photo storage.");
} else {
  dotenv.config({ path: ".env.local", quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const storage = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }).storage;
  const bucket = storage.from("pickup-proofs");
  const path = `verification/${randomUUID()}.png`;
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1kAAAAASUVORK5CYII=", "base64");
  let attemptedUpload = false;
  try {
    const metadata = await storage.getBucket("pickup-proofs");
    assert.ifError(metadata.error); assert.equal(metadata.data.public, false);
    assert.equal(metadata.data.file_size_limit, 5 * 1024 * 1024);
    assert.ok(metadata.data.allowed_mime_types.includes("image/png"));
    attemptedUpload = true;
    const upload = await bucket.upload(path, bytes, { contentType: "image/png", upsert: false, cacheControl: "0" });
    assert.ifError(upload.error);
    const signed = await bucket.createSignedUrl(path, 60);
    assert.ifError(signed.error);
    const download = await fetch(signed.data.signedUrl, { signal: AbortSignal.timeout(15000) });
    assert.equal(download.ok, true);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
    const anonymous = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } });
    const denied = await anonymous.storage.from("pickup-proofs").download(path);
    assert.ok(denied.error); assert.equal(denied.data, null);
    const publicAccess = await fetch(bucket.getPublicUrl(path).data.publicUrl, { signal: AbortSignal.timeout(15000) });
    assert.equal(publicAccess.ok, false);
    console.log("Verified private photo upload, signed download, and anonymous/public access denial.");
  } finally {
    if (attemptedUpload) {
      const cleanup = await bucket.remove([path]);
      assert.ifError(cleanup.error);
      console.log("Removed the temporary verification image.");
    }
  }
}
