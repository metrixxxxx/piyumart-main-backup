import bcrypt from "bcrypt";
import { db } from "@/lib/db";

export async function POST(req) {
  const { firstName, lastName, email, password, contactNumber, address } = await req.json();

  if (!email.endsWith("@lspu.edu.ph")) {
    return Response.json({ message: "Only LSPU email allowed" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

 try {
    await db.query(
      "INSERT INTO users (name, last_name, email, password, contact_number, address) VALUES ($1, $2, $3, $4, $5, $6)",
      [firstName, lastName, email, hashedPassword, contactNumber, address]
    );

    return Response.json({ message: "User created" });
  } catch (err) {
    console.error("Register error:", err.message); // ← add this
    return Response.json({ message: err.message }, { status: 400 }); // ← show real error
  }
}