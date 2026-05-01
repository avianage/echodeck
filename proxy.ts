import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/auth/signin',
  '/auth/verify',
  '/auth/setup',
  '/auth/banned',
  '/auth/link-account',
  '/auth/confirm-link',
  '/auth/link-success',
  '/auth/error',
  '/api/auth',
  '/api/health',
  '/api/user/check-username',
  '/api/user/setup',
  '/discover',
  '/maintenance',
  '/offline',
  '/',
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- CORS HANDLING ---
  const origin = req.headers.get('origin');
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  let nextAuthOrigin = '';
  try {
    if (nextAuthUrl) nextAuthOrigin = new URL(nextAuthUrl).origin;
  } catch {}

  const allowedOrigins = [
    'https://echodeck.avianage.in',
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
    nextAuthOrigin,
  ].filter(Boolean);

  const isAllowedOrigin =
    origin && (allowedOrigins.includes(origin) || origin === req.nextUrl.origin);
  const responseOrigin = isAllowedOrigin
    ? origin!
    : nextAuthOrigin || 'https://echodeck.avianage.in';

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': responseOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const applyCors = (res: NextResponse) => {
    res.headers.set('Access-Control-Allow-Origin', responseOrigin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
  };

  // Skip maintenance check for now during debugging

  const isPublicPath = PUBLIC_PATHS.some((p) => {
    if (p === '/') return pathname === '/';
    return pathname.startsWith(p);
  });

  if (isPublicPath) {
    return applyCors(NextResponse.next());
  }

  const token = await getToken({ req });

  const purifyUrl = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      if (
        url.port === '3002' ||
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        !url.hostname.includes('.') ||
        /^[a-f0-9]{8,}$/.test(url.hostname)
      ) {
        const publicUrl = new URL(url.pathname + url.search, responseOrigin);
        return publicUrl.toString();
      }
    } catch {}
    return urlStr;
  };

  if (!token && pathname.startsWith('/party/')) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', purifyUrl(req.url));
    return applyCors(NextResponse.redirect(purifyUrl(signInUrl.toString())));
  }

  if (
    token &&
    !(token as Record<string, unknown>).username &&
    pathname !== '/auth/setup' &&
    !pathname.startsWith('/api/')
  ) {
    const setupUrl = new URL('/auth/setup', req.url);
    setupUrl.searchParams.set('callbackUrl', purifyUrl(req.url));
    return applyCors(NextResponse.redirect(purifyUrl(setupUrl.toString())));
  }

  if (token && pathname.startsWith('/stream')) {
    const role = (token as Record<string, unknown>).platformRole;
    if (role !== 'CREATOR' && role !== 'OWNER') {
      return applyCors(NextResponse.redirect(new URL('/dashboard', req.url)));
    }
  }

  return applyCors(NextResponse.next());
}

export default proxy;

export const config = {
  matcher: [
    /*
     * Run middleware on all paths EXCEPT:
     * - _next/static  (JS chunks, CSS, fonts)
     * - _next/image   (Next.js image optimization)
     * - favicon.ico
     * - public folder files
     * - cdn-cgi       (Cloudflare)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|public/|cdn-cgi/).*)',
  ],
};
