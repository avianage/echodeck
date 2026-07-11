declare module 'youtube-search-api' {
  const youtubesearchapi: {
    GetListByKeyword: (
      keyword: string,
      withPlaylist?: boolean,
      limit?: number,
      options?: Array<{ type?: string }>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) => Promise<{ items: any[] }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    GetVideoDetails: (videoId: string) => Promise<any>;
    GetPlaylistData: (
      playlistId: string,
      limit?: number,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) => Promise<{ items: any[] }>;
  };
  export default youtubesearchapi;
}
