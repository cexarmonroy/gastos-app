import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";
import { rateLimit } from "./rate-limit";
import { logSecurityEvent } from "./security-audit";
import bcrypt from "bcryptjs";

const LOGIN_RATE_MAX = 10;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;

function isEmailDomainAllowed(email: string): boolean {
  const allowedDomains = process.env.AUTH_ALLOWED_EMAIL_DOMAINS?.split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (!allowedDomains?.length) return true;

  const domain = email.split("@")[1]?.toLowerCase();
  return Boolean(domain && allowedDomains.includes(domain));
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.toLowerCase();

        if (rateLimit(`login:${email}`, LOGIN_RATE_MAX, LOGIN_RATE_WINDOW_MS)) {
          await logSecurityEvent("LOGIN_BLOCKED", { email, reason: "rate_limit" });
          throw new Error("Demasiados intentos de inicio de sesión. Intenta en 15 minutos.");
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          await logSecurityEvent("LOGIN_FAILED", { email, reason: "invalid_credentials" });
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          await logSecurityEvent("LOGIN_FAILED", { email, reason: "invalid_password" });
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email;
      }

      if (token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email as string },
            select: { id: true, role: true },
          });

          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
          }
        } catch (error) {
          console.error("JWT role refresh failed:", error);
        }
      }

      return token;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email;
        if (!email) return false;

        if (!isEmailDomainAllowed(email)) {
          return false;
        }

        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (!existingUser) {
          await logSecurityEvent("LOGIN_FAILED", {
            email,
            reason: "oauth_not_registered",
            provider: "google",
          });
          return false;
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
    updateAge: 60 * 60,
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  pages: {
    signIn: "/",
  },
};
