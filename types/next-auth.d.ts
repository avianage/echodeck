import { DefaultSession, DefaultJWT } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      username?: string | null;
      displayName?: string | null;
      platformRole?: 'MEMBER' | 'CREATOR' | 'OWNER';
      spotifyConnected?: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id?: string;
    username?: string;
    platformRole?: 'MEMBER' | 'CREATOR' | 'OWNER';
    spotifyConnected?: boolean;
  }
}
