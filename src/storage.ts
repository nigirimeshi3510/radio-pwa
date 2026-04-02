import { PlaybackPrefs, Playlist, RadioItem } from './types';
import { makeId } from './utils';

const LEGACY_ITEMS_KEY = 'radio.items.v1';
const LEGACY_PREFS_KEY = 'radio.playback-prefs.v1';
const ITEMS_KEY = 'radio.items.v2';
const PLAYLISTS_KEY = 'radio.playlists.v1';
const PREFS_KEY = 'radio.playback-prefs.v2';

export const DEFAULT_PLAYLISTS: Playlist[] = [
  { id: 'playlist-1', name: 'リスト1' },
  { id: 'playlist-2', name: 'リスト2' },
];

const bootstrapDate = new Date().toISOString();

const defaultItems: RadioItem[] = [
  {
    id: makeId(),
    title: '匿名ラジオ 50',
    url: 'https://omocoro.heteml.net/radio/tokumei/50iga8.mp3',
    createdAt: bootstrapDate,
    playlistId: DEFAULT_PLAYLISTS[0].id,
  },
  {
    id: makeId(),
    title: 'ウォッチラジオ 162',
    url: 'https://omocoro.heteml.net/radio/watch/watch162.mp3',
    createdAt: bootstrapDate,
    playlistId: DEFAULT_PLAYLISTS[0].id,
  },
];

const defaultPrefs: PlaybackPrefs = {
  shuffle: false,
  volume: 0.85,
  selectedPlaylistId: DEFAULT_PLAYLISTS[0].id,
  lastPlayedByPlaylist: {
    [DEFAULT_PLAYLISTS[0].id]: undefined,
    [DEFAULT_PLAYLISTS[1].id]: undefined,
  },
};

type LegacyRadioItem = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
};

type LegacyPlaybackPrefs = {
  shuffle?: boolean;
  volume?: number;
  lastPlayedId?: string;
};

function safeParse<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadItems() {
  const stored = safeParse<RadioItem[]>(ITEMS_KEY, []);
  if (stored.length > 0) {
    return stored;
  }

  const legacyItems = safeParse<LegacyRadioItem[]>(LEGACY_ITEMS_KEY, []);
  if (legacyItems.length > 0) {
    return legacyItems.map((item) => ({
      ...item,
      playlistId: DEFAULT_PLAYLISTS[0].id,
    }));
  }

  return defaultItems;
}

export function saveItems(items: RadioItem[]) {
  window.localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

export function loadPlaylists() {
  const stored = safeParse<Playlist[]>(PLAYLISTS_KEY, []);
  if (stored.length === DEFAULT_PLAYLISTS.length) {
    return stored;
  }

  return DEFAULT_PLAYLISTS;
}

export function savePlaylists(playlists: Playlist[]) {
  window.localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
}

export function loadPrefs() {
  const stored = safeParse<PlaybackPrefs | null>(PREFS_KEY, null);
  if (stored) {
    return {
      ...defaultPrefs,
      ...stored,
      lastPlayedByPlaylist: {
        ...defaultPrefs.lastPlayedByPlaylist,
        ...stored.lastPlayedByPlaylist,
      },
    };
  }

  const legacyPrefs = safeParse<LegacyPlaybackPrefs>(LEGACY_PREFS_KEY, {});
  return {
    ...defaultPrefs,
    shuffle: legacyPrefs.shuffle ?? defaultPrefs.shuffle,
    volume: legacyPrefs.volume ?? defaultPrefs.volume,
    lastPlayedByPlaylist: {
      ...defaultPrefs.lastPlayedByPlaylist,
      [DEFAULT_PLAYLISTS[0].id]: legacyPrefs.lastPlayedId,
    },
  };
}

export function savePrefs(prefs: PlaybackPrefs) {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
