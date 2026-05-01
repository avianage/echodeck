'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function RestrictionGuardian({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const user = session.user as { isBanned?: boolean; bannedUntil?: string | null };
      const isBanned = user.isBanned;
      const isTimedOut = user.bannedUntil && new Date(user.bannedUntil) > new Date();

      if ((isBanned || isTimedOut) && !pathname.startsWith('/auth/banned')) {
        // eslint-disable-next-line no-console
        console.log('🚫 [RestrictionGuardian] User is restricted. Redirecting to /auth/banned');
        router.push(`/auth/banned`);
      }
    }
  }, [session, status, pathname, router]);

  return <>{children}</>;
}
