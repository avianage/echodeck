import { Account } from '@prisma/client';

export interface UserData {
  id: string;
  email: string | null;
  username: string | null;
  displayName: string | null;
  image: string | null;
  spotifyConnected: boolean;
  platformRole: 'MEMBER' | 'CREATOR' | 'OWNER';
  allowFriendRequests: boolean;
  partyCode: string | null;
  isBanned: boolean;
  bannedUntil: Date | null;
  banReason: string | null;
  accounts: Pick<Account, 'provider'>[];
  isLive?: boolean;
}
