export const centerEditTitle: string;
export const centerEditBelowTitle: string;
export function centerEditBelowPlan(
  token: string
): ReturnType<typeof centerEditPlan>;
export function centerEditPlan(token: string): {
  token: string;
  corpus: string[];
  readerIndex: number;
  editedIndex: number;
  original: string;
  expanded: string;
  shrunk: string;
  charStart: number;
  charEnd: number;
  tolerancePx: number;
  maxGapMs: number;
  maxAcquisitionMs: number;
  quietTailMs: number;
  minimumHeightChangePx: number;
};
export function replayCenterEditEvidence(
  proof: unknown,
  attempt: { title: string; startTime: string; duration: number }
): {
  verdict: 'PASS' | 'FAIL' | 'INCOMPLETE';
  issues: { code: string; kind: 'failure' | 'incomplete'; index?: number }[];
  readingAssessment: unknown;
  scope: string;
  exposure: string;
  presentedFrames: string;
  responseEndLatency: string;
};
