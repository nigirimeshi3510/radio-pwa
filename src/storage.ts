import { PlaybackPrefs, Playlist, RadioItem } from './types';
import { makeId } from './utils';

const LEGACY_ITEMS_KEY = 'radio.items.v1';
const LEGACY_PREFS_KEY = 'radio.playback-prefs.v1';
const LEGACY_ITEMS_V2_KEY = 'radio.items.v2';
const LEGACY_PLAYLISTS_KEY = 'radio.playlists.v1';
const LEGACY_PREFS_V2_KEY = 'radio.playback-prefs.v2';

const DB_NAME = 'radio-desk-db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

const ITEMS_KEY = 'items';
const PLAYLISTS_KEY = 'playlists';
const PREFS_KEY = 'prefs';
const MIGRATION_KEY = 'migrated-from-localstorage';

export const DEFAULT_PLAYLISTS: Playlist[] = [
  { id: 'playlist-1', name: 'リスト1' },
  { id: 'playlist-2', name: 'リスト2' },
];

const bootstrapDate = new Date().toISOString();

export const defaultItems: RadioItem[] = [
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

export const defaultPrefs: PlaybackPrefs = {
  shuffle: false,
  volume: 0.85,
  selectedPlaylistId: DEFAULT_PLAYLISTS[0].id,
  sortMode: 'default',
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

function hasIndexedDb() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readValue<T>(key: string): Promise<T | undefined> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result as T | undefined);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

async function writeValue<T>(key: string, value: T): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

function buildLegacyItems() {
  const stored = safeParse<RadioItem[]>(LEGACY_ITEMS_V2_KEY, []);
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

function buildLegacyPlaylists() {
  const stored = safeParse<Playlist[]>(LEGACY_PLAYLISTS_KEY, []);
  if (stored.length > 0) {
    return stored;
  }

  return DEFAULT_PLAYLISTS;
}

function buildLegacyPrefs() {
  const stored = safeParse<PlaybackPrefs | null>(LEGACY_PREFS_V2_KEY, null);
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

async function migrateFromLocalStorageIfNeeded() {
  if (!hasIndexedDb()) {
    return;
  }

  const migrated = await readValue<boolean>(MIGRATION_KEY);
  if (migrated) {
    return;
  }

  const items = buildLegacyItems();
  const playlists = buildLegacyPlaylists();
  const prefs = buildLegacyPrefs();

  await Promise.all([
    writeValue(ITEMS_KEY, items),
    writeValue(PLAYLISTS_KEY, playlists),
    writeValue(PREFS_KEY, prefs),
    writeValue(MIGRATION_KEY, true),
  ]);
}

export async function loadAppData() {
  if (!hasIndexedDb()) {
    return {
      items: buildLegacyItems(),
      playlists: buildLegacyPlaylists(),
      prefs: buildLegacyPrefs(),
    };
  }

  await migrateFromLocalStorageIfNeeded();

  const [items, playlists, prefs] = await Promise.all([
    readValue<RadioItem[]>(ITEMS_KEY),
    readValue<Playlist[]>(PLAYLISTS_KEY),
    readValue<PlaybackPrefs>(PREFS_KEY),
  ]);

  return {
    items: items && items.length > 0 ? items : defaultItems,
    playlists: playlists && playlists.length > 0 ? playlists : DEFAULT_PLAYLISTS,
    prefs: prefs
      ? {
          ...defaultPrefs,
          ...prefs,
          lastPlayedByPlaylist: {
            ...defaultPrefs.lastPlayedByPlaylist,
            ...prefs.lastPlayedByPlaylist,
          },
        }
      : defaultPrefs,
  };
}

export function saveItems(items: RadioItem[]) {
  if (!hasIndexedDb()) {
    window.localStorage.setItem(LEGACY_ITEMS_V2_KEY, JSON.stringify(items));
    return Promise.resolve();
  }
  return writeValue(ITEMS_KEY, items);
}

export function savePlaylists(playlists: Playlist[]) {
  if (!hasIndexedDb()) {
    window.localStorage.setItem(LEGACY_PLAYLISTS_KEY, JSON.stringify(playlists));
    return Promise.resolve();
  }
  return writeValue(PLAYLISTS_KEY, playlists);
}

export function savePrefs(prefs: PlaybackPrefs) {
  if (!hasIndexedDb()) {
    window.localStorage.setItem(LEGACY_PREFS_V2_KEY, JSON.stringify(prefs));
    return Promise.resolve();
  }
  return writeValue(PREFS_KEY, prefs);
}
