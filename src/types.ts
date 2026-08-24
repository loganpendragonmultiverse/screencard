export type MediaType = 'movie' | 'tv';

export interface SearchResult {
  id: number;
  media_type: MediaType;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
}

export interface Credit {
  id: number;
  name: string;
  character?: string;
  job?: string;
}

export interface Video {
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface MediaDetails extends SearchResult {
  genres: { id: number; name: string }[];
  runtime?: number | null;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status: string;
  tagline: string;
  homepage: string;
  credits: { cast: Credit[]; crew: Credit[] };
  videos: { results: Video[] };
}

export interface MediaRef {
  id: number;
  mediaType: MediaType;
  addedAt: number;
}

export type ViewingStatus = 'want-to-watch' | 'watching' | 'watched' | 'paused' | 'skipped';
export type Priority = 'low' | 'normal' | 'high';

export interface SavedList {
  id: string;
  name: string;
  createdAt: number;
}

export interface LibraryEntry extends MediaRef {
  listIds: string[];
  status: ViewingStatus;
  priority: Priority;
  personalRating: number | null;
  tags: string[];
}

export interface LibraryState {
  version: 2;
  lists: SavedList[];
  entries: LibraryEntry[];
}

export interface ComparisonSet {
  id: string;
  name: string;
  savedAt: number;
  media: Array<Pick<MediaRef, 'id' | 'mediaType'>>;
}

export interface ScreenCardBackup {
  format: 'screencard-backup';
  version: 2;
  exportedAt: string;
  library: LibraryState;
  notes: Record<string, string>;
  comparisonSets: ComparisonSet[];
}

export interface CacheRecord<T> {
  savedAt: number;
  expiresAt: number;
  data: T;
}

export interface ExportBundle {
  format: 'screencard-research';
  version: 1;
  exportedAt: string;
  cards: Array<{ media: MediaDetails; note?: string }>;
  attribution: string;
}
