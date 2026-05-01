import { getServerSession } from 'next-auth';
import { isRateLimited } from '@/app/lib/rateLimit';
import { logger } from '@/lib/logger';
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

const tx = {
  session: { deleteMany: jest.fn() },
  account: { deleteMany: jest.fn() },
  verificationToken: { deleteMany: jest.fn() },
  upvote: { deleteMany: jest.fn() },
  favorite: { deleteMany: jest.fn() },
  friendship: { deleteMany: jest.fn() },
  streamAccess: { deleteMany: jest.fn() },
  sessionMember: { deleteMany: jest.fn() },
  listeningActivity: { deleteMany: jest.fn() },
  currentStream: { deleteMany: jest.fn() },
  streamEvent: { deleteMany: jest.fn() },
  stream: { deleteMany: jest.fn() },
  user: { delete: jest.fn() },
};

jest.mock('@/app/lib/db', () => ({
  prismaClient: {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    session: { deleteMany: jest.fn() },
    account: { deleteMany: jest.fn() },
    stream: { deleteMany: jest.fn() },
    upvote: { deleteMany: jest.fn() },
  },
}));

jest.mock('@/app/lib/rateLimit', () => ({
  isRateLimited: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

class MockHeaders {
  private values = new Map<string, string[]>();

  constructor(init?: [string, string][]) {
    init?.forEach(([key, value]) => this.append(key, value));
  }

  append(key: string, value: string) {
    const existing = this.values.get(key) ?? [];
    this.values.set(key, [...existing, value]);
  }
}

class MockResponse {
  status: number;
  headers?: Headers;

  constructor(_body: unknown, init?: ResponseInit) {
    this.status = init?.status ?? 200;
    this.headers = init?.headers as Headers | undefined;
  }
}

describe('GDPR user deletion endpoint', () => {
  let DELETE: () => Promise<{ status: number }>;

  beforeAll(() => {
    (globalThis as { Headers?: typeof Headers }).Headers = MockHeaders as unknown as typeof Headers;
    (globalThis as { Response?: typeof Response }).Response =
      MockResponse as unknown as typeof Response;
    ({ DELETE } = require('@/app/api/user/delete/route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (isRateLimited as jest.Mock).mockReturnValue(false);
    (prismaClient.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));
  });

  it('returns 401 for unauthenticated requests', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await DELETE();

    expect(response.status).toBe(401);
    expect(prismaClient.$transaction).not.toHaveBeenCalled();
  });

  it('triggers deletion of all user data in a transaction for authenticated requests', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    });
    (prismaClient.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });

    await DELETE();

    expect(prismaClient.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(tx.account.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(tx.verificationToken.deleteMany).toHaveBeenCalled();
    expect(tx.upvote.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(tx.favorite.deleteMany).toHaveBeenCalled();
    expect(tx.friendship.deleteMany).toHaveBeenCalled();
    expect(tx.streamAccess.deleteMany).toHaveBeenCalled();
    expect(tx.sessionMember.deleteMany).toHaveBeenCalled();
    expect(tx.listeningActivity.deleteMany).toHaveBeenCalled();
    expect(tx.currentStream.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(tx.streamEvent.deleteMany).toHaveBeenCalledWith({ where: { creatorId: 'user-1' } });
    expect(tx.stream.deleteMany).toHaveBeenCalled();
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(prismaClient.user.delete).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      { userId: 'user-1', timestamp: expect.any(String) },
      'GDPR user deletion',
    );
  });

  it('is atomic when the transaction fails before running deletion operations', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    });
    (prismaClient.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    (prismaClient.$transaction as jest.Mock).mockRejectedValue(new Error('transaction failed'));

    const response = await DELETE();

    expect(response.status).toBe(500);
    expect(tx.session.deleteMany).not.toHaveBeenCalled();
    expect(tx.account.deleteMany).not.toHaveBeenCalled();
    expect(tx.stream.deleteMany).not.toHaveBeenCalled();
    expect(tx.upvote.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(prismaClient.user.delete).not.toHaveBeenCalled();
  });

  it('returns 204 on success', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    });
    (prismaClient.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });

    const response = await DELETE();

    expect(response.status).toBe(204);
  });
});
