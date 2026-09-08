/** Supplemental raw replay for the existing held-request cancellation slice.
 * Original navigation/transport replay must qualify separately. No paint claim. */
export function assessPendingThreadShell(raw: any, plan: any, pending: any) {
  const issues: {
    code: string;
    kind: 'failure' | 'incomplete';
    index?: number;
  }[] = [];
  const add = (
    code: string,
    kind: 'failure' | 'incomplete' = 'incomplete',
    index?: number
  ) => issues.push({ code, kind, ...(index === undefined ? {} : { index }) });
  const finite = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v);
  const finish = () => ({
    verdict: issues.some((i) => i.kind === 'failure')
      ? 'FAIL'
      : issues.length
        ? 'INCOMPLETE'
        : 'PASS',
    issues,
    scope:
      'Sampled current loading shell and Back affordance during an original held GET; original navigation/transport replay required separately.',
    backActivation: 'UNEXECUTED',
    errorAndRetry: 'UNEXECUTED',
    presentedFrames: 'INCOMPLETE',
  });
  try {
    const samples = raw.samples,
      events = raw.events,
      request = pending.requests?.[0];
    if (
      pending.kind !== 'missing-parent' ||
      pending.requests.length !== 1 ||
      !Array.isArray(samples) ||
      samples.length < 6 ||
      events.length !== 2 ||
      events[0].kind !== 'click' ||
      events[1].kind !== 'popstate' ||
      events.some((e: any) => !finite(e.time) || e.trusted !== true) ||
      !finite(request.interceptedTime) ||
      !finite(request.releasedTime) ||
      request.interceptedTime < events[0].time ||
      events[1].time < request.interceptedTime + 200 ||
      request.releasedTime <= events[1].time ||
      plan.maxGapMs !== 100 ||
      plan.maxMeasurementMs !== 32 ||
      plan.maxOutgoingMs !== 250 ||
      plan.completionMs !== 1000 ||
      plan.quietTailMs !== 1000 ||
      plan.tolerancePx !== 1
    ) {
      add('invalid-shell-slice-contract');
      return finish();
    }
    const route = plan.scopes.thread.route,
      returned = plan.scopes.channel.route;
    let firstPending: number | undefined, lastPending: number | undefined;
    samples.forEach((s: any, index: number) => {
      if (
        !finite(s.time) ||
        !finite(s.durationMs) ||
        s.durationMs < 0 ||
        s.durationMs > 32 ||
        s.documentVisible !== true ||
        !Array.isArray(s.threadShells) ||
        (index > 0 &&
          (s.time < samples[index - 1].time ||
            s.time - samples[index - 1].time > 100))
      ) {
        add('incomplete-shell-acquisition', 'incomplete', index);
        return;
      }
      const all = s.threadShells;
      if (
        all.some(
          (x: any) =>
            typeof x.exposed !== 'boolean' ||
            !finite(x.opacity) ||
            !Array.isArray(x.texts) ||
            !Array.isArray(x.back) ||
            !Array.isArray(x.titles) ||
            !Number.isInteger(x.progressCount) ||
            x.progressCount < 0
        )
      ) {
        add('malformed-shell-observation', 'incomplete', index);
        return;
      }
      const shown = all.filter((x: any) => x.exposed);
      if (s.time >= events[1].time) {
        if (s.route === returned && shown.length)
          add('shell-reappeared-after-back', 'failure', index);
        return;
      }
      if (s.time < request.interceptedTime || s.route !== route) return;
      firstPending ??= s.time;
      lastPending = s.time;
      if (shown.length !== 1) {
        add('missing-or-duplicate-current-shell', 'failure', index);
        return;
      }
      const shell = shown[0];
      const labels = shell.texts.filter(
        (x: any) =>
          x.text === 'Loading thread…' && x.exposed && x.opacity >= 0.99
      );
      const titles = shell.titles.filter(
        (x: any) => x.exposed && x.opacity >= 0.99 && x.text === 'Thread'
      );
      if (
        shell.opacity < 0.99 ||
        labels.length !== 1 ||
        titles.length !== 1 ||
        shell.progressCount !== 1 ||
        shell.texts.some(
          (x: any) =>
            x.exposed &&
            [
              'Could not load this thread.',
              'This thread is not available yet.',
              'Try again',
            ].includes(x.text)
        )
      )
        add('wrong-or-hidden-pending-shell', 'failure', index);
      const backs = shell.back.filter((x: any) => x.exposed);
      if (backs.length !== 1) {
        add('missing-or-duplicate-shell-back', 'failure', index);
        return;
      }
      const b = backs[0];
      if (
        ![
          b.opacity,
          b.rect?.left,
          b.rect?.right,
          b.rect?.top,
          b.rect?.bottom,
          b.clip?.left,
          b.clip?.right,
          b.clip?.top,
          b.clip?.bottom,
        ].every(finite) ||
        typeof b.hit !== 'boolean' ||
        typeof b.disabled !== 'boolean' ||
        typeof b.pointerEvents !== 'string'
      ) {
        add('malformed-back-observation', 'incomplete', index);
        return;
      }
      if (
        b.opacity < 0.99 ||
        b.disabled ||
        b.pointerEvents === 'none' ||
        !b.hit ||
        b.rect.right <= b.rect.left ||
        b.rect.bottom <= b.rect.top ||
        b.clip.left > b.rect.left + 1 ||
        b.clip.right < b.rect.right - 1 ||
        b.clip.top > b.rect.top + 1 ||
        b.clip.bottom < b.rect.bottom - 1
      )
        add('hidden-clipped-or-obstructed-back', 'failure', index);
    });
    if (
      firstPending === undefined ||
      lastPending === undefined ||
      firstPending - request.interceptedTime > 100 ||
      events[1].time - lastPending > 100 ||
      lastPending - firstPending < 100
    )
      add('missing-continuous-held-shell-interval');
  } catch {
    add('malformed-shell-proof');
  }
  return finish();
}
