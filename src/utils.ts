import { RadioItem } from './types';

export function makeId() {
  if (
    typeof globalThis !== 'undefined' &&
    'crypto' in globalThis &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeTitle(input: string, url: string) {
  const trimmed = input.trim();
  if (trimmed) {
    return trimmed;
  }

  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    const segment = segments[segments.length - 1];
    return segment ?? url;
  } catch {
    return url;
  }
}

export function isValidMp3Url(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.pathname.toLowerCase().endsWith('.mp3')
    );
  } catch {
    return false;
  }
}

export function formatHostLabel(value: string) {
  try {
    const url = new URL(value);
    const segments = url.pathname.split('/').filter(Boolean);
    const filename = segments[segments.length - 1];
    return filename ? `${url.hostname} / ${filename}` : url.hostname;
  } catch {
    return value;
  }
}

export function createShuffledIds(items: RadioItem[], currentId?: string) {
  const ids = items.map((item) => item.id);
  const shuffled = [...ids];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  if (!currentId) {
    return shuffled;
  }

  const currentIndex = shuffled.indexOf(currentId);
  if (currentIndex > 0) {
    [shuffled[0], shuffled[currentIndex]] = [shuffled[currentIndex], shuffled[0]];
  }

  return shuffled;
}

export function parseBatchUrls(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function extractDigits(value: string) {
  return value.replace(/\D+/g, '');
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCsvEntries(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const header = parseCsvLine(lines[0]).map((value) => value.toLowerCase());
  const titleIndex = header.findIndex((value) => value === 'title' || value === 'タイトル');
  const urlIndex = header.findIndex((value) => value === 'url' || value === 'link' || value === 'リンク');

  const hasHeader = titleIndex !== -1 || urlIndex !== -1;
  const startIndex = hasHeader ? 1 : 0;

  return lines.slice(startIndex).map((line) => {
    const columns = parseCsvLine(line);
    const url = urlIndex !== -1 ? columns[urlIndex] ?? '' : columns[0] ?? '';
    const title = titleIndex !== -1 ? columns[titleIndex] ?? '' : columns[1] ?? '';
    return {
      url: url.trim(),
      title: title.trim(),
    };
  });
}
