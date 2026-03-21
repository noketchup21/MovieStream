const LIBRARY_STORAGE_PREFIX = "moviestream_library_";

const resolveStorageKey = (userId) => {
  if (!userId) return null;
  return `${LIBRARY_STORAGE_PREFIX}${userId}`;
};

const readLibrary = (userId) => {
  const key = resolveStorageKey(userId);
  if (!key) return [];

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) => item && typeof item.imdb_id === "string");
  } catch {
    return [];
  }
};

const writeLibrary = (userId, items) => {
  const key = resolveStorageKey(userId);
  if (!key) return;

  localStorage.setItem(key, JSON.stringify(items));
};

export const getLibraryMovies = (userId) => {
  return readLibrary(userId);
};

export const isMovieInLibrary = (userId, imdbId) => {
  if (!imdbId) return false;
  const items = readLibrary(userId);
  return items.some((item) => item.imdb_id === imdbId);
};

export const saveMovieToLibrary = (userId, movie) => {
  if (!movie?.imdb_id) return false;

  const items = readLibrary(userId);
  const exists = items.some((item) => item.imdb_id === movie.imdb_id);
  if (exists) return true;

  const nextMovie = {
    imdb_id: movie.imdb_id,
    title: movie.title || "Untitled",
    poster_path: movie.poster_path || "",
    ranking: movie.ranking || null,
    saved_at: new Date().toISOString(),
  };

  writeLibrary(userId, [nextMovie, ...items]);
  return true;
};

export const removeMovieFromLibrary = (userId, imdbId) => {
  if (!imdbId) return;

  const items = readLibrary(userId);
  const nextItems = items.filter((item) => item.imdb_id !== imdbId);
  writeLibrary(userId, nextItems);
};