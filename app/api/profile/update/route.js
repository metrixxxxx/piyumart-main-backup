import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import bcrypt from "bcryptjs";
import path from "path";
import { mkdir, writeFile } from "fs/promises";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  let formData;

  try {
    formData = await req.formData();
  } catch {
    return Response.json({ message: "Invalid form data" }, { status: 400 });
  }

  const firstName      = formData.get("firstName")?.trim();
  const lastName       = formData.get("lastName")?.trim();
  const contactNumber  = formData.get("contactNumber")?.trim() || null;
  const address        = formData.get("address")?.trim() || null;
  const currentPassword = formData.get("currentPassword") || null;
  const newPassword    = formData.get("newPassword") || null;
  const imageFile      = formData.get("image");

  // Basic validation
  if (!firstName || !lastName) {
    return Response.json({ message: "First name and last name are required" }, { status: 400 });
  }

  if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
    return Response.json(
      { message: "Both current and new password are required to change password" },
      { status: 400 }
    );
  }

  if (newPassword && newPassword.length < 8) {
    return Response.json(
      { message: "New password must be at least 8 characters" },
      { status: 400 }
    );
  }

  try {
    // ── Password change ──────────────────────────────────────
    if (currentPassword && newPassword) {
      const [rows] = await db.query(
        "SELECT password FROM users WHERE id = $1",
        [userId]
      );

      if (!rows.length) {
        return Response.json({ message: "User not found" }, { status: 404 });
      }

      const match = await bcrypt.compare(currentPassword, rows[0].password);
      if (!match) {
        return Response.json({ message: "Current password is incorrect" }, { status: 400 });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await db.query("UPDATE users SET password = $1 WHERE id = $2", [hashed, userId]);
    }

    // ── Avatar upload ────────────────────────────────────────
    let imagePath = null;
    if (imageFile && imageFile.size > 0) {
      if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
        return Response.json(
          { message: "Invalid image type. Only JPEG, PNG, and WebP are allowed" },
          { status: 400 }
        );
      }

      if (imageFile.size > MAX_IMAGE_SIZE) {
        return Response.json(
          { message: "Image must be smaller than 5MB" },
          { status: 400 }
        );
      }

      const ext = path.extname(imageFile.name).toLowerCase();
      const filename = `avatar_${userId}_${Date.now()}${ext}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");

      await mkdir(uploadDir, { recursive: true });
      await writeFile(
        path.join(uploadDir, filename),
        Buffer.from(await imageFile.arrayBuffer())
      );

      imagePath = `/uploads/avatars/${filename}`;
    }

    // ── Profile update ───────────────────────────────────────
    const fields = [
      "name = $1",
      "last_name = $2",
      "contact_number = $3",
      "address = $4",
    ];
    const values = [firstName, lastName, contactNumber, address];

    if (imagePath) {
      values.push(imagePath);
      fields.push(`image = $${values.length}`);
    }

    values.push(userId);
    await db.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${values.length}`,
      values
    );

    return Response.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("[profile/update]", err);
    return Response.json(
      { message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : err.message },
      { status: 500 }
    );
  }
}