export type { SpotifyTrack } from './spotify';
export type { YouTubeVideoDetails, YouTubeThumbnail } from './youtube-api';
export type { YT, YTPlayer } from './youtube';

export interface StreamData {
  id: string;
  title: string;
  bigImg?: string;
  smallImg?: string;
  genre?: string;
  user?: {
    id?: string;
    username?: string;
    image?: string;
    partyCode?: string;
  };
  currentStream?: {
    viewerCount: number;
  };
  isLive?: boolean;
  stream?: {
    id: string;
    title: string;
    bigImg?: string;
    smallImg?: string;
  } | null;
}
