import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

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

        if (!email.endsWith("@lspu.edu.ph")) throw new Error("Only LSPU email allowed");

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
  ],
  callbacks: {
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
      session.user.role = token.role;
      session.user.lastName = token.lastName;
      session.user.image = token.image;
      session.user.contactNumber = token.contactNumber;
      session.user.address = token.address;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };