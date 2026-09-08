export const paginationTitle: string;
export const paginationAttachment: string;
export function paginationPlan(token: string): {
  token: string;
  corpus: string[];
  failures: number;
  pageCount: number;
  maxGapMs: number;
  maxMeasurementMs: number;
  tolerancePx: number;
  quietTailMs: number;
};
export function paginationBackendRows(
  body: unknown
): Array<{ id: string; sequence: number; text: string; author: string }> | null;
export function replayPaginationEvidence(
  proof: unknown,
  attempt: { title: string; startTime: string; duration: number }
): {
  verdict: 'PASS' | 'FAIL' | 'INCOMPLETE';
  issues: Array<{
    code?: string;
    message?: string;
    kind: 'failure' | 'incomplete';
  }>;
  readings: unknown[];
  presentedFrames: string;
  scope: string;
};
