import { db } from "@/lib/db"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import type { NextAuthOptions } from "next-auth"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        })
        if (!user) {
          throw new Error('No account found with this email address')
        }

        if (!user.password) {
          throw new Error('Please contact support - account setup incomplete')
        }
    
        // Block login if user is not Active
        if (user.status === 'Deleted') {
          throw new Error('Your account is removed. Please contact your admin.')
        }
        if (user.status !== 'Active') {
          throw new Error('Account is not active. Please check your email for the invitation.')
        }

        const isValid = await compare(credentials.password, user.password)
        if (!isValid) {
          throw new Error('Password is incorrect')
        }

        // Update lastSeen on successful login
        await db.user.update({
          where: { id: user.id },
          data: { lastSeen: new Date() },
        }).catch(() => {})

        return { 
          id: user.id, 
          email: user.email, 
          name: user.name,
          image: user.image,
          globalRole: user.globalRole,
          isDemo: user.isDemo
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.globalRole = (user as any).globalRole;
        token.isDemo = (user as any).isDemo;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).globalRole = token.globalRole as string;
        (session.user as any).isDemo = token.isDemo as boolean;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
