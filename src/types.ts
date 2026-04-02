export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export type SortMode = 'default' | 'number_desc' | 'number_asc';

export type TabId = 'player' | 'library';

export type Playlist = {
  id: string;
  name: string;
};

export type RadioItem = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  playlistId: string;
};

export type PlaybackPrefs = {
  shuffle: boolean;
  volume: number;
  selectedPlaylistId: string;
  lastPlayedByPlaylist: Record<string, string | undefined>;
  sortMode: SortMode;
};
