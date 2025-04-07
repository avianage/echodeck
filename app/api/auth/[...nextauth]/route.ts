import { prismaClient } from "@/app/lib/db";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt", // Make this explicit
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      try {
        const existingUser = await prismaClient.user.findUnique({
          where: { email: user.email },
        });

        if (!existingUser) {
          await prismaClient.user.create({
            data: {
              email: user.email,
              provider: "Google",
            },
          });
        }
      } catch (e) {
        console.error("Signin Error: ", e);
        return false;
      }
      return true;
    },
  },
});

export { handler as GET, handler as POST }