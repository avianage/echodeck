'use client';
import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  // Without this, the session only refreshes on window focus, so a ban
  // applied mid-session (RestrictionGuardian relies on session.user.isBanned)
  // wouldn't be enforced until the user next switches back to the tab.
  // Paired with the 60s ban-check TTL in app/lib/auth.ts's jwt callback.
  return <SessionProvider refetchInterval={60}>{children}</SessionProvider>;
}
