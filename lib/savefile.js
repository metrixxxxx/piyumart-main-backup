import { supabaseAdmin } from "@/lib/supabase";

export async function saveFile(file, folder = "products") {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const filename = `${folder}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

  const { error } = await supabaseAdmin.storage
    .from("uploads")
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage
    .from("uploads")
    .getPublicUrl(filename);

  return data.publicUrl;
}