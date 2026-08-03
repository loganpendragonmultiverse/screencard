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

export interface CacheRecord<T> {
  savedAt: number;
  expiresAt: number;
  data: T;
}

export interface ExportBundle {
  format: 'screencard-research';
  version: 1;
  exportedAt: string;
  cards: Array<{ media: MediaDetails; note: string }>;
  attribution: string;
}
