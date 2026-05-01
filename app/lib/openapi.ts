import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

type ApiMethod = 'get' | 'post' | 'patch' | 'delete';
type AuthMode = 'public' | 'session' | 'bearerOrSession';

type ApiRoute = {
  method: ApiMethod;
  path: string;
  auth: AuthMode;
  summary: string;
  requestSchema?: 'genericJson';
  params?: string[];
  query?: string[];
};

export function isApiDocsEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true';
}

const ErrorResponse = z
  .object({
    message: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough()
  .openapi('ErrorResponse');

const SuccessResponse = z.record(z.unknown()).openapi('SuccessResponse');
const GenericRequest = z.record(z.unknown()).openapi('GenericRequest');

const routes: ApiRoute[] = [
  {
    method: 'post',
    path: '/api/admin/assign-creator',
    auth: 'session',
    summary: 'Assign or revoke creator role',
    requestSchema: 'genericJson',
  },
  {
    method: 'post',
    path: '/api/admin/ban',
    auth: 'session',
    summary: 'Apply or remove platform restrictions',
    requestSchema: 'genericJson',
  },
  {
    method: 'delete',
    path: '/api/admin/delete-user',
    auth: 'session',
    summary: 'Delete a user as an owner',
    requestSchema: 'genericJson',
  },
  {
    method: 'get',
    path: '/api/admin/maintenance',
    auth: 'public',
    summary: 'Read maintenance mode',
  },
  {
    method: 'post',
    path: '/api/admin/maintenance',
    auth: 'session',
    summary: 'Update maintenance mode',
    requestSchema: 'genericJson',
  },
  {
    method: 'get',
    path: '/api/admin/streams',
    auth: 'session',
    summary: 'List streams for admins',
  },
  { method: 'get', path: '/api/admin/users', auth: 'session', summary: 'List users for admins' },
  {
    method: 'post',
    path: '/api/auth/disconnect-provider',
    auth: 'session',
    summary: 'Disconnect a linked auth provider',
    requestSchema: 'genericJson',
  },
  {
    method: 'get',
    path: '/api/auth/link-provider',
    auth: 'public',
    summary: 'Verify an account-linking token',
    query: ['token', 'email', 'provider'],
  },
  {
    method: 'post',
    path: '/api/auth/send-link-verification',
    auth: 'public',
    summary: 'Send account-link verification email',
    requestSchema: 'genericJson',
  },
  {
    method: 'get',
    path: '/api/auth/spotify-callback',
    auth: 'public',
    summary: 'Handle Spotify OAuth callback',
    query: ['code', 'state'],
  },
  {
    method: 'get',
    path: '/api/auth/spotify-connect',
    auth: 'session',
    summary: 'Start Spotify account connection',
  },
  {
    method: 'post',
    path: '/api/auth/spotify-disconnect',
    auth: 'session',
    summary: 'Disconnect Spotify account',
  },
  {
    method: 'get',
    path: '/api/auth/{nextauth}',
    auth: 'public',
    summary: 'NextAuth catch-all route',
    params: ['nextauth'],
  },
  {
    method: 'post',
    path: '/api/auth/{nextauth}',
    auth: 'public',
    summary: 'NextAuth catch-all route',
    params: ['nextauth'],
    requestSchema: 'genericJson',
  },
  {
    method: 'get',
    path: '/api/friends/activity',
    auth: 'session',
    summary: 'Read friend activity',
  },
  {
    method: 'post',
    path: '/api/friends/request',
    auth: 'session',
    summary: 'Send a friend request',
    requestSchema: 'genericJson',
  },
  {
    method: 'get',
    path: '/api/friends/requests',
    auth: 'session',
    summary: 'List friend requests',
  },
  {
    method: 'post',
    path: '/api/friends/respond',
    auth: 'session',
    summary: 'Respond to a friend request',
    requestSchema: 'genericJson',
  },
  {
    method: 'get',
    path: '/api/friends/status',
    auth: 'session',
    summary: 'Read friendship status',
    query: ['userId'],
  },
  { method: 'get', path: '/api/health', auth: 'public', summary: 'Health check' },
  {
    method: 'get',
    path: '/api/streams',
    auth: 'session',
    summary: 'List queued streams',
    query: ['creatorId', 'resetAccess'],
  },
  {
    method: 'post',
    path: '/api/streams',
    auth: 'session',
    summary: 'Create a stream queue item',
    requestSchema: 'genericJson',
  },
  {
    method: 'get',
    path: '/api/streams/access',
    auth: 'session',
    summary: 'List stream access requests',
    query: ['creatorId'],
  },
  {
    method: 'post',
    path: '/api/streams/access',
    auth: 'session',
    summary: 'Request, approve, or reject stream access',
    requestSchema: 'genericJson',
  },
  {
    method: 'post',
    path: '/api/streams/ban',
    auth: 'session',
    summary: 'Restrict a stream viewer',
    requestSchema: 'genericJson',
  },
  {
    method: 'post',
    path: '/api/streams/block',
    auth: 'session',
    summary: 'Block a video',
    requestSchema: 'genericJson',
  },
  {
    method: 'post',
    path: '/api/streams/clear',
    auth: 'session',
    summary: 'Clear own stream queue',
  },
  {
    method: 'post',
    path: '/api/streams/downvote',
    auth: 'session',
    summary: 'Remove an upvote',
    requestSchema: 'genericJson',
  },
  {
    method: 'post',
    path: '/api/streams/fix-video',
    auth: 'session',
    summary: 'Replace a restricted video',
    requestSchema: 'genericJson',
  },
  {
    method: 'post',
    path: '/api/streams/heartbeat',
    auth: 'session',
    summary: 'Update or read stream heartbeat',
    requestSchema: 'genericJson',
  },
  {
    method: 'post',
    path: '/api/streams/metadata',
    auth: 'session',
    summary: 'Update stream metadata',
    requestSchema: 'genericJson',
  },
  {
    method: 'delete',
    path: '/api/streams/metadata',
    auth: 'session',
    summary: 'Stop current stream metadata',
  },
  {
    method: 'post',
    path: '/api/streams/moderator',
    auth: 'session',
    summary: 'Promote or demote stream moderator',
    requestSchema: 'genericJson',
  },
  { method: 'get', path: '/api/streams/next', auth: 'session', summary: 'Advance to next stream' },
  {
    method: 'post',
    path: '/api/streams/playlist',
    auth: 'session',
    summary: 'Resolve playlist contents',
    requestSchema: 'genericJson',
  },
  {
    method: 'get',
    path: '/api/streams/proxy',
    auth: 'public',
    summary: 'Proxy an allowed media URL',
    query: ['url'],
  },
  { method: 'get', path: '/api/streams/public', auth: 'public', summary: 'List public streams' },
  {
    method: 'get',
    path: '/api/streams/recommendations',
    auth: 'public',
    summary: 'Get stream recommendations',
    query: ['videoId', 'title'],
  },
  {
    method: 'post',
    path: '/api/streams/remove',
    auth: 'session',
    summary: 'Remove a stream from queue',
    requestSchema: 'genericJson',
  },
  {
    method: 'get',
    path: '/api/streams/resolve',
    auth: 'session',
    summary: 'Resolve stream playback URL',
    query: ['videoId'],
  },
  {
    method: 'get',
    path: '/api/streams/restricted',
    auth: 'session',
    summary: 'List restricted stream users',
    query: ['creatorId'],
  },
  {
    method: 'get',
    path: '/api/streams/search',
    auth: 'session',
    summary: 'Search streams',
    query: ['q'],
  },
  {
    method: 'post',
    path: '/api/streams/sync',
    auth: 'session',
    summary: 'Sync current stream state',
    requestSchema: 'genericJson',
  },
  {
    method: 'post',
    path: '/api/streams/upvote',
    auth: 'session',
    summary: 'Create an upvote',
    requestSchema: 'genericJson',
  },
  {
    method: 'get',
    path: '/api/streams/viewers',
    auth: 'session',
    summary: 'List stream viewers',
    query: ['creatorId'],
  },
  {
    method: 'get',
    path: '/api/streams/{streamId}/events',
    auth: 'session',
    summary: 'Open stream event feed',
    params: ['streamId'],
  },
  {
    method: 'patch',
    path: '/api/streams/{streamId}/visibility',
    auth: 'session',
    summary: 'Update stream visibility',
    params: ['streamId'],
    requestSchema: 'genericJson',
  },
  {
    method: 'get',
    path: '/api/user/check-username',
    auth: 'public',
    summary: 'Check username availability',
    query: ['username'],
  },
  {
    method: 'delete',
    path: '/api/user/delete',
    auth: 'session',
    summary: 'Delete the authenticated user account',
  },
  {
    method: 'post',
    path: '/api/user/delete',
    auth: 'session',
    summary: 'Delete the authenticated user account',
  },
  { method: 'get', path: '/api/user/favorites', auth: 'session', summary: 'List favorite users' },
  {
    method: 'post',
    path: '/api/user/favorites',
    auth: 'session',
    summary: 'Toggle favorite user',
    requestSchema: 'genericJson',
  },
  { method: 'get', path: '/api/user/me', auth: 'session', summary: 'Read current user' },
  { method: 'get', path: '/api/user/privacy', auth: 'session', summary: 'Read privacy settings' },
  {
    method: 'post',
    path: '/api/user/privacy',
    auth: 'session',
    summary: 'Update privacy settings',
    requestSchema: 'genericJson',
  },
  {
    method: 'get',
    path: '/api/user/profile',
    auth: 'session',
    summary: 'Read authenticated profile',
  },
  {
    method: 'get',
    path: '/api/user/public/{username}',
    auth: 'public',
    summary: 'Read public user profile',
    params: ['username'],
  },
  {
    method: 'get',
    path: '/api/user/search',
    auth: 'public',
    summary: 'Search users',
    query: ['q'],
  },
  {
    method: 'post',
    path: '/api/user/setup',
    auth: 'session',
    summary: 'Complete user setup',
    requestSchema: 'genericJson',
  },
  {
    method: 'post',
    path: '/api/user/update-displayname',
    auth: 'session',
    summary: 'Update display name',
    requestSchema: 'genericJson',
  },
  {
    method: 'post',
    path: '/api/user/update-image',
    auth: 'session',
    summary: 'Update profile image',
    requestSchema: 'genericJson',
  },
  {
    method: 'post',
    path: '/api/user/update-username',
    auth: 'session',
    summary: 'Update username',
    requestSchema: 'genericJson',
  },
];

function securityFor(auth: AuthMode): Record<string, string[]>[] {
  if (auth === 'public') return [];
  if (auth === 'session') return [{ sessionCookie: [] }];
  return [{ bearerAuth: [] }, { sessionCookie: [] }];
}

function buildParameters(route: ApiRoute) {
  return [
    ...(route.params ?? []).map((name) => ({
      name,
      in: 'path' as const,
      required: true,
      schema: { type: 'string' as const },
    })),
    ...(route.query ?? []).map((name) => ({
      name,
      in: 'query' as const,
      required: false,
      schema: { type: 'string' as const },
    })),
  ];
}

export function createOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  registry.register('ErrorResponse', ErrorResponse);
  registry.register('SuccessResponse', SuccessResponse);
  registry.register('GenericRequest', GenericRequest);
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
  registry.registerComponent('securitySchemes', 'sessionCookie', {
    type: 'apiKey',
    in: 'cookie',
    name: 'next-auth.session-token',
    description:
      'NextAuth session cookie. In production this may be __Secure-next-auth.session-token.',
  });

  for (const route of routes) {
    const successStatus = route.method === 'post' ? '200' : '200';
    registry.registerPath({
      method: route.method,
      path: route.path,
      summary: route.summary,
      tags: [route.path.split('/')[2] || 'api'],
      security: securityFor(route.auth),
      parameters: buildParameters(route),
      request: route.requestSchema
        ? {
            body: {
              required: true,
              content: {
                'application/json': {
                  schema: GenericRequest,
                },
              },
            },
          }
        : undefined,
      responses: {
        [successStatus]: {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: SuccessResponse,
            },
          },
        },
        '201': {
          description: 'Resource created',
          content: {
            'application/json': {
              schema: SuccessResponse,
            },
          },
        },
        '204': {
          description: 'Successful response with no content',
        },
        '400': {
          description: 'Bad request or validation error',
          content: {
            'application/json': {
              schema: ErrorResponse,
            },
          },
        },
        '401': {
          description: 'Unauthenticated',
          content: {
            'application/json': {
              schema: ErrorResponse,
            },
          },
        },
        '403': {
          description: 'Forbidden',
          content: {
            'application/json': {
              schema: ErrorResponse,
            },
          },
        },
        '404': {
          description: 'Not found',
          content: {
            'application/json': {
              schema: ErrorResponse,
            },
          },
        },
      },
    });
  }

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'EchoDeck API',
      version: '0.2.0',
      description: 'Basic OpenAPI 3.1 documentation for EchoDeck Next.js API routes.',
    },
    servers: [{ url: process.env.NEXTAUTH_URL || 'http://localhost:3000' }],
  });
}
