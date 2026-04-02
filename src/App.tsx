import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_PLAYLISTS,
  defaultItems,
  defaultPrefs,
  loadAppData,
  saveItems,
  savePlaylists,
  savePrefs,
} from './storage';
import { PlaybackPrefs, PlaybackState, Playlist, RadioItem, TabId } from './types';
import {
  createShuffledIds,
  extractDigits,
  formatHostLabel,
  isValidMp3Url,
  makeId,
  parseCsvEntries,
  normalizeTitle,
  parseBatchUrls,
} from './utils';

type FormState = {
  title: string;
  url: string;
  playlistId: string;
};

const BATCH_FORM_DEFAULT = {
  text: '',
  playlistId: DEFAULT_PLAYLISTS[0].id,
};

function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="control-icon">
      {children}
    </svg>
  );
}

function PlayIcon() {
  return (
    <IconBase>
      <path d="M8 6.5v11l8.5-5.5z" fill="currentColor" />
    </IconBase>
  );
}

function PauseIcon() {
  return (
    <IconBase>
      <rect x="7" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
      <rect x="13.5" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
    </IconBase>
  );
}

function NextIcon() {
  return (
    <IconBase>
      <path d="M6 7v10l7-5z" fill="currentColor" />
      <path d="M13 7v10l7-5z" fill="currentColor" />
      <rect x="19.5" y="7" width="1.5" height="10" rx="0.75" fill="currentColor" />
    </IconBase>
  );
}

function ShuffleIcon() {
  return (
    <IconBase>
      <path
        d="M4 7h3.5c1.2 0 2.3.5 3 1.4l5 6.2c.8.9 1.8 1.4 3 1.4H20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 6h3v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4 17h3.5c1.2 0 2.3-.5 3-1.4l1.5-1.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 10.2l1.5-1.8c.8-.9 1.8-1.4 3-1.4H20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 15h3v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function SeekBackIcon() {
  return (
    <IconBase>
      <path d="M12 7a5 5 0 1 0 4.3 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 3 8.8 6.2 12.8 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="15.2" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="currentColor">10</text>
    </IconBase>
  );
}

function SeekForwardIcon() {
  return (
    <IconBase>
      <path d="M12 7a5 5 0 1 1-4.3 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 3 15.2 6.2 11.2 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="15.2" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="currentColor">10</text>
    </IconBase>
  );
}

export default function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [items, setItems] = useState<RadioItem[]>(defaultItems);
  const [playlists, setPlaylists] = useState<Playlist[]>(DEFAULT_PLAYLISTS);
  const [prefs, setPrefs] = useState<PlaybackPrefs>(defaultPrefs);
  const [activeId, setActiveId] = useState<string | null>(
    defaultPrefs.lastPlayedByPlaylist[defaultPrefs.selectedPlaylistId] ?? null,
  );
  const [hydrated, setHydrated] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [statusText, setStatusText] = useState('停止中');
  const [error, setError] = useState('');
  const [batchMessage, setBatchMessage] = useState('');
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDockExpanded, setIsDockExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('player');
  const [form, setForm] = useState<FormState>({
    title: '',
    url: '',
    playlistId: defaultPrefs.selectedPlaylistId,
  });
  const [batchForm, setBatchForm] = useState(BATCH_FORM_DEFAULT);
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedPlaylistId = prefs.selectedPlaylistId;
  const selectedPlaylist =
    playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? playlists[0] ?? DEFAULT_PLAYLISTS[0];
  const selectedItems = useMemo(
    () => items.filter((item) => item.playlistId === selectedPlaylistId),
    [items, selectedPlaylistId],
  );
  const normalizedSearchQuery = extractDigits(searchQuery);
  const filteredSelectedItems = useMemo(() => {
    const filtered = !normalizedSearchQuery
      ? selectedItems
      : selectedItems.filter((item) => extractDigits(item.title).includes(normalizedSearchQuery));

    if (prefs.sortMode === 'default') {
      return filtered;
    }

    const direction = prefs.sortMode === 'number_desc' ? -1 : 1;
    return [...filtered].sort((left, right) => {
      const leftDigits = extractDigits(left.title);
      const rightDigits = extractDigits(right.title);
      const leftValue = leftDigits ? Number(leftDigits) : Number.NEGATIVE_INFINITY;
      const rightValue = rightDigits ? Number(rightDigits) : Number.NEGATIVE_INFINITY;

      if (leftValue === rightValue) {
        return left.createdAt.localeCompare(right.createdAt) * direction;
      }

      return (leftValue - rightValue) * direction;
    });
  }, [normalizedSearchQuery, prefs.sortMode, selectedItems]);
  const filteredItems = useMemo(() => {
    const normalizedLibrarySearchQuery = extractDigits(librarySearchQuery);

    if (!normalizedLibrarySearchQuery) {
      return items;
    }

    return items.filter((item) => extractDigits(item.title).includes(normalizedLibrarySearchQuery));
  }, [items, librarySearchQuery]);
  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) ?? null,
    [activeId, items],
  );

  useEffect(() => {
    let cancelled = false;

    void loadAppData()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setItems(data.items);
        setPlaylists(data.playlists);
        setPrefs(data.prefs);
        setActiveId(data.prefs.lastPlayedByPlaylist[data.prefs.selectedPlaylistId] ?? null);
        setForm((current) => ({
          ...current,
          playlistId: data.prefs.selectedPlaylistId,
        }));
        setBatchForm((current) => ({
          ...current,
          playlistId: data.prefs.selectedPlaylistId,
        }));
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) {
          setHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    saveItems(items);
  }, [hydrated, items]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    savePlaylists(playlists);
  }, [hydrated, playlists]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    savePrefs(prefs);
  }, [hydrated, prefs]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    setPrefs((current) => ({
      ...current,
      lastPlayedByPlaylist: {
        ...current.lastPlayedByPlaylist,
        [selectedPlaylistId]: activeId ?? undefined,
      },
    }));
  }, [activeId, hydrated, selectedPlaylistId]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      playlistId: editingId ? current.playlistId : selectedPlaylistId,
    }));
    setBatchForm((current) => ({
      ...current,
      playlistId: selectedPlaylistId,
    }));
  }, [selectedPlaylistId, editingId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = prefs.volume;
  }, [prefs.volume]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const rememberedId = prefs.lastPlayedByPlaylist[selectedPlaylistId] ?? null;
    setQueue([]);
    setActiveId((current) => {
      if (current && items.some((item) => item.id === current && item.playlistId === selectedPlaylistId)) {
        return current;
      }
      return rememberedId;
    });
  }, [prefs.lastPlayedByPlaylist, selectedPlaylistId, items]);

  const playNext = () => {
    if (selectedItems.length === 0) {
      return;
    }

    const currentQueue =
      queue.length > 0 ? queue : buildQueue(selectedItems, activeId ?? undefined, prefs.shuffle);
    const currentIndex = activeId ? currentQueue.indexOf(activeId) : -1;
    const nextId = currentQueue[currentIndex + 1];

    if (!nextId) {
      setPlaybackState('paused');
      setStatusText('再生完了');
      return;
    }

    void startPlayback(nextId, false, currentQueue);
  };

  const playPrevious = () => {
    if (selectedItems.length === 0) {
      return;
    }

    const currentQueue =
      queue.length > 0 ? queue : buildQueue(selectedItems, activeId ?? undefined, prefs.shuffle);
    const currentIndex = activeId ? currentQueue.indexOf(activeId) : -1;
    const previousId = currentQueue[currentIndex - 1];
    const fallbackId = currentQueue[0];

    if (previousId) {
      void startPlayback(previousId, false, currentQueue);
      return;
    }

    if (fallbackId) {
      void startPlayback(fallbackId, false, currentQueue);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleWaiting = () => {
      setPlaybackState('loading');
      setStatusText('読み込み中');
    };
    const handlePlaying = () => {
      setPlaybackState('playing');
      setStatusText('再生中');
    };
    const handlePause = () => {
      setPlaybackState((current) => (current === 'error' ? current : 'paused'));
      setStatusText('一時停止');
    };
    const handleEnded = () => {
      setCurrentTime(0);
      playNext();
    };
    const handleError = () => {
      setPlaybackState('error');
      setStatusText('再生失敗');
      setError('この音源は再生できませんでした。URLまたは配信設定を確認してください。');
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setCurrentTime(audio.currentTime);
    };
    const handleDurationChange = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);

    return () => {
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
    };
  }, [activeId, selectedItems, playNext]);

  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof window === 'undefined' ||
      typeof window.MediaMetadata === 'undefined'
    ) {
      return;
    }

    try {
      if (!activeItem) {
        navigator.mediaSession.metadata = null;
        return;
      }

      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: activeItem.title,
        artist: 'Radio Desk',
        album: formatHostLabel(activeItem.url),
      });

      try {
        navigator.mediaSession.setActionHandler('play', () => {
          void resumePlayback();
        });
      } catch {}

      try {
        navigator.mediaSession.setActionHandler('pause', () => {
          pausePlayback();
        });
      } catch {}

      try {
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          playNext();
        });
      } catch {}

      try {
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          playPrevious();
        });
      } catch {}
    } catch {
      // Ignore partial Media Session support on iPhone Safari.
    }
  }, [activeItem, playNext, playPrevious]);

  function buildQueue(sourceItems: RadioItem[], seedId?: string, shuffle = prefs.shuffle) {
    if (sourceItems.length === 0) {
      return [];
    }

    return shuffle ? createShuffledIds(sourceItems, seedId) : sourceItems.map((item) => item.id);
  }

  async function startPlayback(itemId: string, rebuildQueue = true, incomingQueue?: string[]) {
    const item = items.find((entry) => entry.id === itemId);
    const audio = audioRef.current;

    if (!item || !audio) {
      return;
    }

    if (isOffline) {
      setError('オフライン中は音声を再生できません。通信が戻ると再生できます。');
      return;
    }

    const playlistItems = items.filter((entry) => entry.playlistId === item.playlistId);
    const nextQueue = incomingQueue ?? (rebuildQueue ? buildQueue(playlistItems, itemId) : queue);
    if (nextQueue.length > 0) {
      setQueue(nextQueue);
    }

    setError('');
    setBatchMessage('');
    if (item.playlistId !== selectedPlaylistId) {
      setPrefs((current) => ({
        ...current,
        selectedPlaylistId: item.playlistId,
      }));
    }
    setActiveId(itemId);
    setPlaybackState('loading');
    setStatusText('読み込み中');

    if (audio.src !== item.url) {
      audio.src = item.url;
      setCurrentTime(0);
      setDuration(0);
    }

    try {
      await audio.play();
    } catch {
      setPlaybackState('error');
      setStatusText('再生失敗');
      setError('自動再生がブロックされたか、音源にアクセスできません。再生ボタンを押してください。');
    }
  }

  async function resumePlayback() {
    if (!activeItem) {
      if (selectedItems.length > 0) {
        await startPlayback(selectedItems[0].id);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    try {
      await audio.play();
    } catch {
      setError('再生を開始できませんでした。画面上の操作から再度試してください。');
    }
  }

  function pausePlayback() {
    audioRef.current?.pause();
  }

  function toggleShuffle() {
    const nextShuffle = !prefs.shuffle;
    setPrefs((current) => ({ ...current, shuffle: nextShuffle }));
    setQueue(buildQueue(selectedItems, activeId ?? undefined, nextShuffle));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const url = form.url.trim();
    if (!isValidMp3Url(url)) {
      setError('MP3のhttp/https URLを入力してください。');
      return;
    }

    const duplicated = items.some((item) => item.url === url && item.id !== editingId);
    if (duplicated) {
      setError('同じURLはすでに登録されています。');
      return;
    }

    const title = normalizeTitle(form.title, url);
    const playlistId = form.playlistId;

    if (editingId) {
      setItems((current) =>
        current.map((item) =>
          item.id === editingId ? { ...item, title, url, playlistId } : item,
        ),
      );

      if (activeId === editingId && audioRef.current) {
        audioRef.current.src = url;
      }

      setEditingId(null);
    } else {
      setItems((current) => [
        {
          id: makeId(),
          title,
          url,
          createdAt: new Date().toISOString(),
          playlistId,
        },
        ...current,
      ]);
    }

    setForm({
      title: '',
      url: '',
      playlistId,
    });
    setError('');
    setBatchMessage('');
  }

  function handleEdit(item: RadioItem) {
    setEditingId(item.id);
    setActiveTab('library');
    setForm({ title: item.title, url: item.url, playlistId: item.playlistId });
    setError('');
    setBatchMessage('');
  }

  function handleDelete(itemId: string) {
    const nextItems = items.filter((item) => item.id !== itemId);
    setItems(nextItems);
    setQueue((current) => current.filter((id) => id !== itemId));

    if (activeId === itemId) {
      audioRef.current?.pause();
      if (audioRef.current) {
        audioRef.current.src = '';
      }
      setActiveId(null);
      setPlaybackState('idle');
      setStatusText('停止中');
    }
  }

  function handleBatchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const lines = parseBatchUrls(batchForm.text);
    if (lines.length === 0) {
      setError('一括追加するURLを1行ずつ入力してください。');
      setBatchMessage('');
      return;
    }

    const existingUrls = new Set(items.map((item) => item.url));
    const seen = new Set<string>();
    const validEntries: RadioItem[] = [];
    let invalidCount = 0;
    let duplicateCount = 0;

    lines.forEach((url) => {
      if (!isValidMp3Url(url)) {
        invalidCount += 1;
        return;
      }

      if (existingUrls.has(url) || seen.has(url)) {
        duplicateCount += 1;
        return;
      }

      seen.add(url);
      validEntries.push({
        id: makeId(),
        title: normalizeTitle('', url),
        url,
        createdAt: new Date().toISOString(),
        playlistId: batchForm.playlistId,
      });
    });

    if (validEntries.length === 0) {
      setError('追加できるURLがありませんでした。重複や無効URLを確認してください。');
      setBatchMessage('');
      return;
    }

    setItems((current) => [...validEntries, ...current]);
    setBatchForm((current) => ({
      ...current,
      text: '',
    }));
    setError('');
    setBatchMessage(
      `${validEntries.length}件追加しました。` +
        (duplicateCount > 0 ? ` 重複 ${duplicateCount}件をスキップ。` : '') +
        (invalidCount > 0 ? ` 無効URL ${invalidCount}件をスキップ。` : ''),
    );
  }

  async function handleCsvImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const rows = parseCsvEntries(text);

    if (rows.length === 0) {
      setError('CSVに取り込めるデータがありませんでした。');
      setBatchMessage('');
      event.target.value = '';
      return;
    }

    const existingUrls = new Set(items.map((item) => item.url));
    const seen = new Set<string>();
    const validEntries: RadioItem[] = [];
    let invalidCount = 0;
    let duplicateCount = 0;

    rows.forEach((row) => {
      const url = row.url.trim();
      if (!isValidMp3Url(url)) {
        invalidCount += 1;
        return;
      }

      if (existingUrls.has(url) || seen.has(url)) {
        duplicateCount += 1;
        return;
      }

      seen.add(url);
      validEntries.push({
        id: makeId(),
        title: normalizeTitle(row.title, url),
        url,
        createdAt: new Date().toISOString(),
        playlistId: batchForm.playlistId,
      });
    });

    if (validEntries.length === 0) {
      setError('CSVから追加できるURLがありませんでした。');
      setBatchMessage('');
      event.target.value = '';
      return;
    }

    setItems((current) => [...validEntries, ...current]);
    setError('');
    setBatchMessage(
      `CSVから${validEntries.length}件追加しました。` +
        (duplicateCount > 0 ? ` 重複 ${duplicateCount}件をスキップ。` : '') +
        (invalidCount > 0 ? ` 無効URL ${invalidCount}件をスキップ。` : ''),
    );
    event.target.value = '';
  }

  function renamePlaylist(playlistId: string, name: string) {
    setPlaylists((current) =>
      current.map((playlist) =>
        playlist.id === playlistId ? { ...playlist, name: name.trim() || playlist.name } : playlist,
      ),
    );
  }

  function switchPlaylist(playlistId: string) {
    setPrefs((current) => ({
      ...current,
      selectedPlaylistId: playlistId,
    }));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({
      title: '',
      url: '',
      playlistId: selectedPlaylistId,
    });
  }

  function handleSeek(value: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(duration) || duration <= 0) {
      return;
    }

    audio.currentTime = value;
    setCurrentTime(value);
  }

  function seekBy(delta: number) {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const nextTime = Math.max(0, Math.min(audio.currentTime + delta, Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + delta));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function formatTime(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      return '0:00';
    }

    const totalSeconds = Math.floor(value);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  return (
    <div className="app-shell">
      <audio ref={audioRef} preload="none" />

      <nav className="tab-bar" aria-label="アプリタブ">
        <button
          type="button"
          className={`tab-button ${activeTab === 'player' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('player')}
        >
          再生
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'library' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('library')}
        >
          登録
        </button>
      </nav>

      <main className="main-grid">
        <div className="tab-content-scroll">
          {activeTab === 'player' ? (
            <>
              <section className="panel now-playing">
                <div className="player-toolbar">
                  <div className="player-toolbar-grid">
                    <select
                      className="playlist-select"
                      value={selectedPlaylistId}
                      onChange={(event) => switchPlaylist(event.target.value)}
                    >
                      {playlists.map((playlist) => (
                        <option key={playlist.id} value={playlist.id}>
                          {playlist.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="playlist-select"
                      value={prefs.sortMode}
                      onChange={(event) =>
                        setPrefs((current) => ({
                          ...current,
                          sortMode: event.target.value as PlaybackPrefs['sortMode'],
                        }))
                      }
                    >
                      <option value="default">並び替えなし</option>
                      <option value="number_desc">番号が新しい順</option>
                      <option value="number_asc">番号が古い順</option>
                    </select>
                  </div>
                </div>

                <div className="track-card">
                  <div className="track-card-header">
                    <h2>{activeItem?.title ?? 'まだ選択されていません'}</h2>
                    <button
                      type="button"
                      className={`toggle-button icon-only-button ${prefs.shuffle ? 'is-active' : ''}`}
                      onClick={toggleShuffle}
                      aria-label="シャッフル"
                    >
                      <ShuffleIcon />
                    </button>
                  </div>
                </div>
              </section>

              <section className="panel list-panel">
                <div className="search-bar">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="検索"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(extractDigits(event.target.value))}
                  />
                </div>
                <div className="station-list">
                  {filteredSelectedItems.map((item) => (
                    <article
                      key={item.id}
                      className={`station-card ${item.id === activeId ? 'is-active' : ''}`}
                    >
                      <button
                        type="button"
                        className="station-main"
                        onClick={() => {
                          void startPlayback(item.id);
                        }}
                      >
                        <strong>{item.title}</strong>
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="panel form-panel">
                <div className="section-head">
                  <span className="section-label">{editingId ? '音源を編集' : '音源を追加'}</span>
                </div>

                <form onSubmit={handleSubmit} className="entry-form">
                  <label>
                    <span>タイトル</span>
                    <input
                      type="text"
                      inputMode="text"
                      placeholder="未入力ならURL末尾を使います"
                      value={form.title}
                      onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    />
                  </label>

                  <label>
                    <span>MP3 URL</span>
                    <input
                      type="url"
                      inputMode="url"
                      placeholder="https://example.com/radio.mp3"
                      value={form.url}
                      onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                      required
                    />
                  </label>

                  <label>
                    <span>所属リスト</span>
                    <select
                      value={form.playlistId}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, playlistId: event.target.value }))
                      }
                    >
                      {playlists.map((playlist) => (
                        <option key={playlist.id} value={playlist.id}>
                          {playlist.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="form-actions">
                    <button type="submit" className="primary">
                      {editingId ? '更新する' : '追加する'}
                    </button>
                    {editingId ? (
                      <button type="button" className="secondary" onClick={cancelEdit}>
                        キャンセル
                      </button>
                    ) : null}
                  </div>
                </form>
              </section>

              <section className="panel form-panel">
                <div className="section-head">
                  <span className="section-label">一括追加</span>
                </div>

                <form onSubmit={handleBatchSubmit} className="entry-form">
                  <label>
                    <span>追加先リスト</span>
                    <select
                      value={batchForm.playlistId}
                      onChange={(event) =>
                        setBatchForm((current) => ({ ...current, playlistId: event.target.value }))
                      }
                    >
                      {playlists.map((playlist) => (
                        <option key={playlist.id} value={playlist.id}>
                          {playlist.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>MP3 URLを1行ずつ貼り付け</span>
                    <textarea
                      rows={7}
                      placeholder={'https://example.com/a.mp3\nhttps://example.com/b.mp3'}
                      value={batchForm.text}
                      onChange={(event) =>
                        setBatchForm((current) => ({ ...current, text: event.target.value }))
                      }
                    />
                  </label>

                  <button type="submit" className="primary">
                    まとめて追加する
                  </button>
                </form>

                <div className="csv-import">
                  <label className="file-upload">
                    <span>CSVファイルから追加</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvImport}
                    />
                  </label>
                  <p className="file-upload-note">`url,title` または `title,url` ヘッダー付きCSVに対応</p>
                </div>

                <div className="notice-stack">
                  <p className="notice">タイトルはURL末尾のファイル名で自動登録します。</p>
                  {batchMessage ? <p className="notice">{batchMessage}</p> : null}
                </div>
              </section>

              <section className="panel list-panel">
                <div className="section-head">
                  <span className="section-label">プレイリスト設定</span>
                </div>

                <div className="playlist-settings">
                  {playlists.map((playlist) => (
                    <label key={playlist.id} className="playlist-name-field">
                      <span>{playlist.id === DEFAULT_PLAYLISTS[0].id ? 'リスト1名' : 'リスト2名'}</span>
                      <input
                        type="text"
                        value={playlist.name}
                        onChange={(event) => renamePlaylist(playlist.id, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section className="panel list-panel">
                <div className="section-head">
                  <span className="section-label">登録済み音源</span>
                  <span className="count-chip">{items.length}件</span>
                </div>

                <div className="search-bar">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="検索"
                    value={librarySearchQuery}
                    onChange={(event) => setLibrarySearchQuery(extractDigits(event.target.value))}
                  />
                </div>

                <div className="station-list">
                  {filteredItems.map((item) => (
                    <article
                      key={item.id}
                      className={`station-card ${item.id === activeId ? 'is-active' : ''}`}
                    >
                      <button
                        type="button"
                        className="station-main"
                        onClick={() => {
                          switchPlaylist(item.playlistId);
                          setActiveTab('player');
                          void startPlayback(item.id);
                        }}
                      >
                        <strong>{item.title}</strong>
                        <small>{playlists.find((playlist) => playlist.id === item.playlistId)?.name}</small>
                      </button>
                      <div className="station-actions">
                        <button type="button" className="ghost" onClick={() => handleEdit(item)}>
                          編集
                        </button>
                        <button type="button" className="ghost danger" onClick={() => handleDelete(item.id)}>
                          削除
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {activeTab === 'player' ? (
        <div className="bottom-player-dock">
          {isDockExpanded ? (
            <div className="seekbar-block">
              <input
                type="range"
                min="0"
                max={duration > 0 ? duration : 0}
                step="0.1"
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => handleSeek(Number(event.target.value))}
                disabled={duration <= 0}
                aria-label="再生位置"
              />
              <div className="seekbar-time">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="seekbar-actions">
                <button
                  type="button"
                  className="secondary icon-button seek-jump"
                  onClick={() => seekBy(-10)}
                  disabled={duration <= 0}
                  aria-label="10秒戻る"
                >
                  <SeekBackIcon />
                </button>
                <button
                  type="button"
                  className="secondary icon-button seek-jump"
                  onClick={() => seekBy(10)}
                  disabled={duration <= 0}
                  aria-label="10秒進む"
                >
                  <SeekForwardIcon />
                </button>
              </div>
            </div>
          ) : null}
          <div className="control-cluster dock-compact">
            <button
              type="button"
              className="dock-title-button"
              onClick={() => setIsDockExpanded((current) => !current)}
              aria-expanded={isDockExpanded}
              aria-label="シークバーを開閉"
            >
              <span>{activeItem?.title ?? '未再生'}</span>
            </button>
            <button
              type="button"
              className="primary play-button icon-button"
              onClick={() => {
                if (playbackState === 'playing') {
                  pausePlayback();
                } else {
                  void resumePlayback();
                }
              }}
              disabled={selectedItems.length === 0}
              aria-label={playbackState === 'playing' ? '一時停止' : '再生'}
            >
              {playbackState === 'playing' ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              className="secondary icon-button"
              onClick={playNext}
              disabled={selectedItems.length === 0}
              aria-label="次へ"
            >
              <NextIcon />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
