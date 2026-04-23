import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      globalRole: string;
      isDemo: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    globalRole: string;
    isDemo: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    globalRole: string;
    isDemo: boolean;
  }
}
