export function replayNativeRecording(trace: unknown): {
  verdict: 'COMPLETE' | 'INCOMPLETE';
  issues: { code: string; frame?: number }[];
  evidenceLevel: 'native-buffer-acquisition-only';
  productVerdict: 'UNASSESSED';
  nativePresentation: 'INCOMPLETE';
  metrics?: {
    samples: number;
    maxOperationMs: number;
    concealedSamples: number;
    semanticSamples: number;
  };
};
