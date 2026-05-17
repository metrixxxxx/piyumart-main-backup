import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import bcrypt from "bcryptjs";
import path from "path";
import { mkdir, writeFile } from "fs/promises";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const firstName     = formData.get("firstName");
  const lastName      = formData.get("lastName");
  const contactNumber = formData.get("contactNumber");
  const address       = formData.get("address");
  const currentPassword = formData.get("currentPassword");
  const newPassword   = formData.get("newPassword");
  const imageFile     = formData.get("image");
  const userId        = session.user.id;

  try {
    let imagePath = null;
    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
      await mkdir(uploadDir, { recursive: true });
      const filename = `avatar_${userId}_${Date.now()}${path.extname(imageFile.name)}`;
      await writeFile(path.join(uploadDir, filename), buffer);
      imagePath = `/uploads/avatars/${filename}`;
    }

    if (currentPassword && newPassword) {
      const [rows] = await db.query("SELECT password FROM users WHERE id=$1", [userId]);
      const user = rows[0];
      if (!user) return Response.json({ message: "User not found" }, { status: 404 });

      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) return Response.json({ message: "Current password is incorrect" }, { status: 400 });

      const hashed = await bcrypt.hash(newPassword, 10);
      await db.query("UPDATE users SET password=$1 WHERE id=$2", [hashed, userId]);
    }

    const values = [firstName, lastName, contactNumber, address];
    const fields = ["name=$1", "last_name=$2", "contact_number=$3", "address=$4"];

    if (imagePath) {
      values.push(imagePath);
      fields.push(`image=$${values.length}`);
    }

    values.push(userId);
    await db.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id=$${values.length}`,
      values
    );

    return Response.json({ message: "Profile updated" });
  } catch (err) {
    console.error(err);
    return Response.json({ message: "Something went wrong" }, { status: 500 });
  }
}