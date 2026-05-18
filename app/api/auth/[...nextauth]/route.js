import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),

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

        // Only allow LSPU emails
        if (!email.endsWith("@lspu.edu.ph")) {
          throw new Error("Only LSPU email allowed");
        }

        const [rows] = await db.query(
          "SELECT * FROM users WHERE email=$1",
          [email]
        );

        if (rows.length === 0) return null;

        const user = rows[0];

        const isValid = await bcrypt.compare(
          password,
          user.password
        );

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
          hasPassword: !!user.password,
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // GOOGLE LOGIN
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase();

        // Only allow LSPU emails
        if (!email.endsWith("@lspu.edu.ph")) {
          return false;
        }

        try {
          const [rows] = await db.query(
            "SELECT * FROM users WHERE email=$1",
            [email]
          );

          // Auto create user if not existing
          if (rows.length === 0) {
            const nameParts = user.name?.split(" ") ?? ["", ""];
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(" ");

            await db.query(
              `
              INSERT INTO users
              (name, last_name, email, image, password)
              VALUES ($1, $2, $3, $4, $5)
              `,
              [
                firstName,
                lastName,
                email,
                user.image,
                null,
              ]
            );
          }

          return true;
        } catch (err) {
          console.error("Google signIn error:", err);
          return false;
        }
      }

      return true;
    },

    async jwt({ token, user }) {
      // When user logs in
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.lastName = user.lastName;
        token.image = user.image;
        token.contactNumber = user.contactNumber;
        token.address = user.address;
        token.hasPassword = user.hasPassword;
      }

      // Refresh user data from DB
      if (token.email) {
        const [rows] = await db.query(
          "SELECT * FROM users WHERE email=$1",
          [token.email]
        );

        if (rows.length > 0) {
          const u = rows[0];

          token.id = u.id;
          token.role = u.role;
          token.lastName = u.last_name;
          token.image = u.image;
          token.contactNumber = u.contact_number;
          token.address = u.address;
          token.hasPassword = !!u.password;
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
      session.user.hasPassword = token.hasPassword;

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };