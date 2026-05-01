import { getServerSession } from 'next-auth';
import { isRateLimited } from '@/app/lib/rateLimit';
import { prismaClient } from '@/app/lib/db';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (_body: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
    }),
  },
}));

jest.mock('@/app/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/app/lib/db', () => ({
  prismaClient: {
    user: {
      findUnique: jest.fn(),
    },
    friendship: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('@/app/lib/rateLimit', () => ({
  isRateLimited: jest.fn(),
}));

jest.mock('@/app/lib/getSessionRole', () => ({
  getStreamRole: jest.fn(),
}));

jest.mock('@/app/lib/permissions', () => ({
  hasPermission: jest.fn(),
}));

jest.mock('@/app/lib/spotify', () => ({
  getSpotifyApi: jest.fn(),
  getUserSpotifyApi: jest.fn(),
}));

jest.mock('@/app/lib/spotifyToken', () => ({
  getValidSpotifyToken: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('youtube-search-api', () => ({
  GetVideoDetails: jest.fn(),
  GetListByKeyword: jest.fn(),
}));

jest.mock('spotify-url-info', () =>
  jest.fn(() => ({
    getTracks: jest.fn(),
  })),
);

const jsonRequest = (body: unknown) => ({
  json: jest.fn().mockResolvedValue(body),
});

describe('API status codes', () => {
  let createStream: (req: never) => Promise<{ status: number }>;
  let sendFriendRequest: (req: never) => Promise<{ status: number }>;

  beforeAll(() => {
    (globalThis as unknown as { fetch?: jest.Mock }).fetch = jest.fn();
    ({ POST: createStream } = require('@/app/api/streams/route'));
    ({ POST: sendFriendRequest } = require('@/app/api/friends/request/route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (isRateLimited as jest.Mock).mockReturnValue(false);
  });

  it('returns 400 for validation errors', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com' },
    });

    const response = await createStream(
      jsonRequest({ creatorId: 'creator-1', url: 'not-a-stream-url' }) as never,
    );

    expect(response.status).toBe(400);
  });

  it('returns 404 for not-found scenarios', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'requester-1' },
    });
    (prismaClient.user.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await sendFriendRequest(jsonRequest({ username: 'missing-user' }) as never);

    expect(response.status).toBe(404);
  });

  it('returns 401 for unauthorized requests', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await sendFriendRequest(jsonRequest({ username: 'target-user' }) as never);

    expect(response.status).toBe(401);
  });

  it('returns 403 for forbidden requests', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'requester-1' },
    });
    (prismaClient.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'target-1',
      allowFriendRequests: false,
    });

    const response = await sendFriendRequest(jsonRequest({ username: 'target-user' }) as never);

    expect(response.status).toBe(403);
  });

  it('returns 201 for created resources', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'requester-1' },
    });
    (prismaClient.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'target-1',
      allowFriendRequests: true,
    });
    (prismaClient.friendship.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaClient.friendship.create as jest.Mock).mockResolvedValue({
      id: 'friendship-1',
    });

    const response = await sendFriendRequest(jsonRequest({ username: 'target-user' }) as never);

    expect(response.status).toBe(201);
  });
});
