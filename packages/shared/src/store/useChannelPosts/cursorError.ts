export type CursorAnchorDiagnostics = {
  present: boolean;
  sequenceNum: number | null;
  isDeleted: boolean;
};

export type CursorDiagnostics = {
  cursorPostId: string;
  before: CursorAnchorDiagnostics;
  returned: CursorAnchorDiagnostics;
  after: CursorAnchorDiagnostics;
  fetchedPostCount: number;
  fetchedDeletedCount: number;
};

// Only a successful fetch and readback can produce this error. Transport and
// database exceptions must retain their ordinary retry/error behavior.
export class CursorNormalizationError extends Error {
  constructor(
    readonly channelId: string,
    readonly diagnostics: CursorDiagnostics
  ) {
    super('Failed to normalize cursor');
    this.name = 'CursorNormalizationError';
  }
}
