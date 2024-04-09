export interface SearchState {
  query: string;
  loading: boolean;
  errored: boolean;
  hasMore: boolean;
  loadMore: () => void;
  searchComplete: boolean;
  numResults: number;
  searchedThroughDate: Date | null;
}
