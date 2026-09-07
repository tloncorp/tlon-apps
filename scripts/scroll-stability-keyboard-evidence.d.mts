export const keyboardScenarios: {
  position: 'latest' | 'history';
  title: string;
  source: string;
  attachment: string;
}[];

export type KeyboardReplayAssessment = {
  verdict: 'PASS' | 'FAIL' | 'INCOMPLETE';
  issues: {
    code: string;
    kind: 'failure' | 'incomplete';
    dimension: 'input' | 'geometry' | 'routing';
    index?: number;
  }[];
  caretGeometry: 'INCOMPLETE';
  presentedFrames: 'INCOMPLETE';
  acknowledgement?: { max: number | null; p95: number | null };
};

/** Attempt metadata must come from the enclosing Playwright result. */
export function replayKeyboardEvidence(
  proof: unknown,
  raw: unknown,
  position: 'latest' | 'history',
  attempt: { title: string; startTime: string; duration: number } | undefined
): KeyboardReplayAssessment;

export const pendingSendScenario: {
  scenario: string;
  title: string;
  source: string;
  attachment: string;
  rawAttachment: string;
  matrix: string[];
};
export function replayPendingSendEvidence(
  attachment: unknown,
  raw: unknown,
  attempt: { title: string; startTime: string; duration: number } | undefined
): KeyboardReplayAssessment;
