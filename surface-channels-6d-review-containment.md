# Session 6d — containment half, for review

**Read this alongside `surface-channels-6d-review-correctness.md`.** The two
halves are split deliberately and are meant for different reviewers: sustained
analysis of sandbox-escape material has twice been refused by an external
provider's classifier, and the refusal tracks subject matter rather than
phrasing. So this document stays at the level of engineering conclusions. Every
specific — probe source, vector spelling, matrix cell — is in the repository at
the paths named, and nothing here needs to be reconstructed from prose.

Nothing in this session added capability to the sandbox or widened its
permissions. Every change below either repaired an instrument that could not
fail, measured something previously asserted, or corrected a claim.

---

## 1. The egress instrument could not fail, and now can

**Conclusion.** The test that verified the sandbox's network isolation was
structurally incapable of failing. Its five probes all aimed at a hostname
reserved by RFC 6761 as permanently unresolvable, so the "blocked" verdict was
the same branch a name-resolution failure takes, and the network-level backstop
was satisfied the same way. Had the isolation stopped working, the test would
have gone on passing.

**What replaced it.** Verdicts are now decided at a real listening server that
would have answered. Three properties make it non-vacuous: a blocked verdict is
zero observed connections rather than an absent error; every probe announces
itself before firing, so a frame that never ran cannot be scored as a frame
whose probes were all blocked; and the negative arm is a peer test rather than a
comment, so a probe that loses the ability to reach the server at all fails
loudly.

**Control.** Removing the sandbox's policy from the document builder makes the
enforced test fail on a specific probe with a specific count. The previous
version of the test survived that same mutation unchanged. Both runs are
recorded in `DECISIONS.md` D171.

**Where.** `apps/tlon-web/sandbox-posture/sandbox.spec.ts`. 195 assertions pass
across three engines.

## 2. Two probes were measuring something other than what they claimed

**Conclusion.** Two of the isolation probes ran against a host page that itself
had an opaque origin, which meant their negative results had two possible causes
and the test could not distinguish them. Measured directly rather than reasoned
about: granting the permission those probes exist to test made no difference in
that setting, confirming the result had been unattributable all along.

**What replaced it.** The host page now has a real origin, where granting the
permission does change the outcome — and that arm ships as a control, so the
attribution is demonstrated on every run rather than assumed.

**Where.** Same file; `DECISIONS.md` D171.1.

## 3. A known-live vector had never been probed

**Conclusion.** A previously recorded finding documented one browser API that
had reached an external origin from inside the sandbox while passing the
authoring gate. It was deferred as a follow-up and never picked up, so the
project's claim about this class of behaviour was licensed for five specific
spellings rather than for the class.

**Result of measuring it.** The vector reproduces exactly as recorded when the
host-page policy is absent, and is stopped before any request is issued under
the policy that actually ships. The paired positive controls confirm the stop is
attributable to the policy rather than to an unrelated side effect.

**A second-order point worth the reviewer's attention.** The API exists on only
one of the three engines. The probe reports that explicitly rather than
navigating, because zero connections on an engine lacking the API would
otherwise have been scored as evidence of containment — the same substitution of
a failure branch for a verdict that made the original instrument vacuous. The
classification exists to make that mistake unrepresentable.

**Where.** `apps/tlon-web/sandbox-posture/navigation.spec.ts`; `DECISIONS.md`
D171.2.

## 4. A named residual, outstanding since session 4, is closed

**Conclusion.** An earlier decision recorded one specific gap as untested and
stated it must be measured "before anyone calls the hole closed"; a later
decision carried it as an explicit precondition. It had remained unmeasured
because every configuration in the matrix exercised the direct case and none
exercised the indirect one, which any non-empty allowlist reintroduces.

**Result.** Measured on all three engines, the behaviour is the safe one. A
positive control confirms the indirect path is reachable when it should be, so
the negative result is about the destination and not about the mechanism being
broken. One further item from the same list remains unmeasured and is named in
the decision record rather than quietly dropped.

**Where.** Same file; `DECISIONS.md` D171.3.

## 5. None of this ran in CI

**Conclusion.** The entire posture matrix ran nowhere in continuous
integration. Per-pull-request protection against a regression consisted of a
policy string pinned in a unit test — which a change to the sandbox flags, to
the document assembly, or to the host policy would pass without incident.

**What changed.** The matrix now runs per pull request on all three engines and
blocks merges rather than merely reporting. Three engines rather than one
because the behaviours diverge by engine, so a single-engine run would license a
claim the matrix makes about three.

**Where.** `.github/workflows/ci.yml`, job `sandbox-posture`, added to the
merge-gating job's dependency list; `DECISIONS.md` D171.4.

## 6. Four artifacts described the shipped posture incorrectly

**Conclusion.** Four places — a source docstring, a decision entry, and two
passages of the plan including the summary sentence most likely to be quoted at
someone — described a control as written but disabled. It has been enabled for
two sessions. All four are corrected, and the plan now states what the rebuilt
suite demonstrates, with its probe list, rather than a summary of it.

**A residual is now stated where the claim is**, rather than left for a reader
to infer: the control is an origin allowlist and not a prohibition, so the
guarantee is origin-restricted navigation and never "no navigation".

**Where.** `DECISIONS.md` D171.5.

---

## What a reviewer of this half should press on

1. **Whether the new instrument is itself vacuous in some way I did not test.**
   The mutation I ran removes the policy. I did not enumerate every other way
   the instrument could silently stop measuring — for instance, a change that
   makes the probes fail to run while still reporting armed.
2. **The one remaining unmeasured item** from the residual list in §4. It is
   named in the record; it is not measured.
3. **Native.** Everything above is web. The equivalent guarantee on iOS and
   Android has no mechanism and no test, which was true before this session and
   remains true after it. This is the single largest gap in the containment
   story and it is not addressed here.
4. **Whether "runs in CI on three engines" is the right cost.** The job installs
   three browsers. If that proves too slow, the failure mode of trimming it is
   the one described in §5, and the reasoning is in the job's own comment.
