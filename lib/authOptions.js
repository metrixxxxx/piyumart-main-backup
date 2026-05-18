import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

async function findOrCreateGoogleUser(profile) {
  const email = (
    profile.email ||
    profile.preferred_email ||
    profile.email_address ||
    profile?.profile?.email
  )?.toLowerCase?.();

  if (!email || !email.endsWith("@lspu.edu.ph")) {
    return null;
  }

  const [rows] = await db.query("SELECT * FROM users WHERE email=$1", [email]);
  if (rows.length > 0) {
    return rows[0];
  }

  const name =
    profile.name ||
    `${profile.given_name || ""} ${profile.family_name || ""}`.trim();
  const [firstName = "", lastName = ""] = name.split(" ") || [];
  const randomPassword = await bcrypt.hash(`${email}-${Date.now()}`, 10);

  const [result] = await db.query(
    "INSERT INTO users (name, last_name, email, password, role, image, contact_number, address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
    [
      name || firstName,
      lastName || "",
      email,
      randomPassword,
      "user",
      profile.picture || null,
      null,
      null,
    ]
  );
  return result[0];
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const email = credentials.email.trim().toLowerCase();
        const password = credentials.password.trim();

        if (!email.endsWith("@lspu.edu.ph")) {
          throw new Error("Only LSPU email allowed");
        }

        const [rows] = await db.query("SELECT * FROM users WHERE email=$1", [email]);
        if (rows.length === 0) return null;

        const user = rows[0];
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          lastName: user.last_name,
          email: user.email,
          role: user.role,
          image: user.image || null,
          contactNumber: user.contact_number || null,
          address: user.address || null,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const googleUser = await findOrCreateGoogleUser(profile || user);
        if (!googleUser) return false;

        user.id = googleUser.id;
        user.role = googleUser.role || "user";
        user.lastName = googleUser.last_name;
        user.image = googleUser.image || user.image || null;
        user.contactNumber = googleUser.contact_number || null;
        user.address = googleUser.address || null;
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.lastName = user.lastName;
        token.image = user.image;
        token.contactNumber = user.contactNumber;
        token.address = user.address;
      }
      if (trigger === "update") {
        const [rows] = await db.query("SELECT * FROM users WHERE id=$1", [token.id]);
        if (rows[0]) {
          const u = rows[0];
          token.name = u.name;
          token.lastName = u.last_name;
          token.image = u.image;
          token.contactNumber = u.contact_number;
          token.address = u.address;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id ?? token.sub;
      session.user.email = token.email || session.user.email;
      session.user.name = token.name || session.user.name;
      session.user.role = token.role;
      session.user.lastName = token.lastName;
      session.user.image = token.image;
      session.user.contactNumber = token.contactNumber;
      session.user.address = token.address;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: "/login",
  },
};