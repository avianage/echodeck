declare module 'youtube-search-api' {
  interface Thumbnail {
    url: string;
    width: number;
    height: number;
  }

  interface VideoDetails {
    title: string;
    thumbnail?: { thumbnails: Thumbnail[] };
    thumbnails?: Thumbnail[];
  }

  interface SearchItem {
    id: string;
    title: string;
    thumbnail?: { thumbnails: Thumbnail[] };
    channelTitle?: string;
    lengthText?: string;
  }

  interface SearchResult {
    items: SearchItem[];
    nextPage?: unknown;
  }

  function GetVideoDetails(videoId: string): Promise<VideoDetails>;
  function GetListByKeyword(
    keyword: string,
    playlist?: boolean,
    limit?: number,
    options?: unknown[],
    nextPage?: unknown,
  ): Promise<SearchResult>;
  function GetPlaylistData(playlistId: string, limit?: number, nextPage?: unknown): Promise<SearchResult>;
  function GetSuggestData(keyword: string): Promise<SearchResult>;
  function NextPage(nextPage: unknown): Promise<SearchResult>;

  const youtubeSearchApi: {
    GetVideoDetails: typeof GetVideoDetails;
    GetListByKeyword: typeof GetListByKeyword;
    GetPlaylistData: typeof GetPlaylistData;
    GetSuggestData: typeof GetSuggestData;
    NextPage: typeof NextPage;
  };

  export = youtubeSearchApi;
}
