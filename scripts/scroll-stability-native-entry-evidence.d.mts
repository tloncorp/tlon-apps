export function replayNativeEntry(trace: unknown): {
  verdict: 'PASS' | 'FAIL' | 'INCOMPLETE';
  acquisition: 'COMPLETE' | 'INCOMPLETE';
  issues: { code: string; kind: 'incomplete' | 'failure'; frame?: number }[];
  evidenceLevel: 'native-buffered-entry-row-model';
  nativePresentation: 'INCOMPLETE';
  inputToUsableLandingLatency: 'INCOMPLETE';
  metrics?: {
    firstContentFrame: number | null;
    maxLandingErrorPt: number;
    checkedContentFrames: number;
    checkedTailFrames: number;
    deadline: number | null;
    tailEnd: number | null;
  };
};
