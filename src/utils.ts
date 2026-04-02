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
