// A candidate timestamp is not evidence: all four moments must have been inspected.
export function verifyClipReview(
  selection,
  presentation,
  receipts,
  info,
  duration
) {
  const keys = presentation.findings.map((_, i) => `group-${i + 1}`);
  if (
    !selection ||
    Object.keys(selection).length !== keys.length ||
    keys.some((k) => !selection[k])
  )
    throw new Error('Missing finding clip decision');
  const windows = keys.map((key) => {
    const group = selection[key];
    if (
      !Array.isArray(group.clips) ||
      group.clips.length > 1 ||
      (group.clips.length === 0 && !group.unavailableReason?.trim())
    )
      throw new Error(
        'Expected a complete clip or an explicit unavailable reason'
      );
    const selected = group.clips.map((clip, index) => {
      if (!clip.label?.trim())
        throw new Error('Additional clips must demonstrate a distinct case');
      const times = ['before', 'trigger', 'outcome', 'settled'].map((name) => {
        const m = clip[name];
        const frame = receipts[m?.evidenceId]?.frames?.find(
          (f) => f.index === m.frame
        );
        if (
          !frame ||
          !m.observation?.trim() ||
          !Number.isFinite(frame.seconds) ||
          info.timestamps?.[m.frame] !== frame.seconds
        )
          throw new Error('Clip moment lacks inspected native-frame evidence');
        return frame.seconds;
      });
      const [before, trigger, outcome, settled] = times;
      if (
        !(
          before <= trigger &&
          trigger < outcome &&
          outcome <= settled &&
          settled < duration
        )
      )
        throw new Error(
          'Clip must include ordered before, trigger, outcome and settled states'
        );
      const start = Math.max(0, before - 1),
        end = Math.min(duration, settled + 2);
      if (end - start > 120)
        throw new Error(
          'Complete clip exceeds two minutes; choose a compact complete case or mark unavailable'
        );
      return {
        start,
        end,
        label: clip.label,
        additionalCase: clip.additionalCase,
        basis: 'verified trigger and outcome',
        moments: clip,
      };
    });
    return selected;
  });
  return windows;
}
