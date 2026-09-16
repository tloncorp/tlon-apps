// execFileSync errors include argv; dispatch inputs can contain signed artifacts.
export function dispatchWorkflow(eas, inputs, ref) {
  try {
    return eas([
      'workflow:run',
      '.eas/workflows/pr-agent-qa-ios.yml',
      '--ref',
      ref,
      ...Object.entries(inputs).flatMap(([key, value]) => [
        '-F',
        `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`,
      ]),
    ]);
  } catch {
    throw new Error(
      'EAS dispatch failed; request inputs omitted from diagnostics'
    );
  }
}
