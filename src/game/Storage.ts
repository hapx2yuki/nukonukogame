const memoryFallback = new Map<string, string>();

export function getStoredValue(key: string, fallback: string): string {
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) {
      memoryFallback.set(key, value);
      return value;
    }
  } catch {
    // Restricted/private contexts can deny access to Storage entirely.
  }
  return memoryFallback.get(key) ?? fallback;
}

export function setStoredValue(key: string, value: string): boolean {
  memoryFallback.set(key, value);
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    // Keep the setting for this page session even when persistence is unavailable.
    return false;
  }
}

export function getStoredNumber(key: string, fallback = 0): number {
  const value = Number(getStoredValue(key, String(fallback)));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
