export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  duration_ms: number;
  album: {
    images: { url: string; height: number; width: number }[];
  };
  external_urls: {
    spotify: string;
  };
  uri: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: {
    items: {
      track: SpotifyTrack;
    }[];
    total: number;
  };
}

export interface PlaylistResult {
  title: string | null;
  tracks: (SpotifyTrack & { url?: string; originalSpotifyUrl?: string })[];
  error: string | null;
}

export interface SearchItem {
  id: string;
  title: string;
  thumbnail?: {
    thumbnails?: { url: string }[];
  };
  artist?: string;
  duration?: string;
}
