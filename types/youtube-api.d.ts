export interface YouTubeThumbnail {
  url: string;
  width: number;
  height: number;
}

export interface YouTubeVideoDetails {
  title: string;
  thumbnail?: {
    thumbnails: YouTubeThumbnail[];
  };
  thumbnails?: YouTubeThumbnail[];
}

export interface YouTubeSearchItem {
  id: string;
  title: string;
  thumbnail?: {
    thumbnails: YouTubeThumbnail[];
  };
  channelTitle?: string;
  lengthText?: string;
  duration?: string;
  durationText?: string;
}

export interface YouTubeSearchResult {
  items: YouTubeSearchItem[];
}

export interface YouTubePlaylistResult {
  title: string;
  items: YouTubeSearchItem[];
}
