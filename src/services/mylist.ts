/**
 * Simple client-side "My List" watchlist backed by localStorage.
 * Stores the minimal MovieCard-compatible shape so the list page can render
 * cards without re-fetching.
 */

const KEY = "mbx:mylist";

export interface MyListItem {
  id?: string | number;
  _id?: string;
  title?: string;
  poster_path?: string;
  vote_average?: number;
  release_date?: string;
  media_type?: string;
}

export function getMyList(): MyListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MyListItem[]) : [];
  } catch {
    return [];
  }
}

function save(list: MyListItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable — ignore */
  }
}

/** A stable identifier for an item (detailPath preferred). */
function keyOf(item: MyListItem): string {
  return String(item._id ?? item.id ?? "");
}

const listeners = new Set<() => void>();

let storageListenerAttached = false;
function ensureStorageListener() {
  if (storageListenerAttached || typeof window === "undefined") return;
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      listeners.forEach((listener) => {
        try {
          listener();
        } catch (err) {
          console.error("Error in mylist subscriber:", err);
        }
      });
    }
  });
  storageListenerAttached = true;
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error("Error in mylist subscriber:", err);
    }
  });
}

export function subscribeMyList(listener: () => void): () => void {
  listeners.add(listener);
  ensureStorageListener();
  return () => {
    listeners.delete(listener);
  };
}

export function isInMyList(item: MyListItem): boolean {
  const k = keyOf(item);
  return getMyList().some((i) => keyOf(i) === k);
}

/** Adds the item if missing, removes it if present. Returns the new state. */
export function toggleMyList(item: MyListItem): boolean {
  const k = keyOf(item);
  if (!k) return false;
  const list = getMyList();
  const exists = list.some((i) => keyOf(i) === k);

  const next = exists ? list.filter((i) => keyOf(i) !== k) : [item, ...list];
  save(next);
  notifyListeners();
  return !exists;
}

