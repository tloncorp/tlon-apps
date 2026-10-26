## 2026.9.8

### Highlights

- **Safer updates and Doctor recovery:** preserve plugin settings, tolerate transient SQLite contention, prevent unsafe Windows schema upgrades, unblock verified-empty Telegram migrations, and keep deep and large-fleet repairs bounded. (#160344, #160702, #160718, #161832, #162290, #162321, #162394) Thanks @EndeavorPioneer, @RomneyDa, @ericcaiwx-star, @PennyVibe, @jasdeepohri-max, @609NFT, @VACInc, @obviyus, and @NickM83.
- **Gateway availability:** prevent duplicate container Gateways, restore managed-proxy TLS health probes, and avoid Windows compile-cache startup hangs. (#160193, #161946, #162841) Thanks @grtninja, @obviyus, @saizero-dr, @NickM83, @VACInc, @ericcaiwx-star, @EndeavorPioneer, @jasdeepohri-max, and @609NFT.
- **Reliable agent turns:** prevent stuck Anthropic background-command turns so later messages continue normally. (#161260) Thanks @VACInc, @obviyus, @ericcaiwx-star, @EndeavorPioneer, @jasdeepohri-max, @NickM83, and @609NFT.
- **Codex reliability:** keep Computer Use native-app readiness independent of browser authentication and prevent large agent fleets from exhausting Gateway memory during Codex session discovery. (#162467, #162912) Thanks @RomneyDa, @obviyus, @609NFT, @WG-Mojo, @hailongguo0530-alt, @VACInc, @ericcaiwx-star, @EndeavorPioneer, @jasdeepohri-max, and @NickM83.
- **Windows sessions:** restore cron setup and session admission across case-insensitive environment proxies. (#160075) Thanks @WG-Mojo and @hailongguo0530-alt.
- **Sandbox and Telegram correctness:** repair read-only skill refreshes without EACCES failures and prevent stale queued Telegram previews from crossing writer-authority boundaries. (#160137, #162304) Thanks @VACInc, @obviyus, @ericcaiwx-star, @EndeavorPioneer, @jasdeepohri-max, @NickM83, and @609NFT.

### Changes

- No intentional capability changes; this release is a focused reliability and recovery hotfix.

### Fixes

- **Update and repair safety:** preserve local-plugin configuration through recovery, refuse unsafe Windows 2026.9.4 schema transitions, retain maintenance leases through transient SQLite contention, archive only verified-empty retired Telegram bindings, and keep deep owner-chain and large-fleet Doctor checks bounded. (#160344, #160702, #160718, #161832, #162290, #162321, #162394) Thanks @EndeavorPioneer, @RomneyDa, @ericcaiwx-star, @PennyVibe, @jasdeepohri-max, @609NFT, @VACInc, @obviyus, and @NickM83.
- **Gateway and onboarding:** enforce single-owner Gateway startup in containers, keep local TLS health checks working with managed proxies, and shorten Windows compile-cache paths. (#160193, #161946, #162841) Thanks @grtninja, @obviyus, @saizero-dr, @NickM83, @VACInc, @ericcaiwx-star, @EndeavorPioneer, @jasdeepohri-max, and @609NFT.
- **Windows sessions:** restore cron setup and session admission across case-insensitive environment proxies. (#160075) Thanks @WG-Mojo and @hailongguo0530-alt.
- **Agent replies:** finish Anthropic turns after background Bash completion so later messages are not silently skipped. (#161260) Thanks @VACInc, @obviyus, @ericcaiwx-star, @EndeavorPioneer, @jasdeepohri-max, @NickM83, and @609NFT.
- **Codex:** avoid unrelated browser authentication during native Computer Use readiness and share captured fleet configuration during session discovery to prevent Gateway heap exhaustion. (#162467, #162912) Thanks @RomneyDa, @obviyus, @609NFT, @WG-Mojo, @hailongguo0530-alt, @VACInc, @ericcaiwx-star, @EndeavorPioneer, @jasdeepohri-max, and @NickM83.
- **Sandbox and Telegram:** restore skill refreshes on read-only installs and recheck queued preview writer authority before Telegram edits. (#160137, #162304) Thanks @VACInc, @obviyus, @ericcaiwx-star, @EndeavorPioneer, @jasdeepohri-max, @NickM83, and @609NFT.

### Complete contribution record

This audited record covers the complete v2026.9.7..45369e8428643a9c00e4e30c32afb9238a016935 history: 35 in-range PRs + 0 retained seed-only PRs = 35 unique PRs. The generation manifest also supplies direct commits as editorial input; the grouped notes above prioritize user impact.

#### Pull requests

- **PR #160224**
- **PR #161256**
- **PR #161291**
- **PR #161079**
- **PR #161418**
- **PR #161463**
- **PR #161520**
- **PR #161516**
- **PR #161515**
- **PR #161754**
- **PR #161632**
- **PR #161633**
- **PR #161635** Related #161550.
- **PR #161713**
- **PR #161404**
- **PR #157954** Thanks @fuller-stack-dev.
- **PR #161876**
- **PR #161968**
- **PR #161985**
- **PR #160075** Related #157067, #159339. Thanks @WG-Mojo and @hailongguo0530-alt.
- **PR #162467** Related #157067, #159339. Thanks @RomneyDa and @WG-Mojo and @hailongguo0530-alt.
- **PR #160344** Related #159477, #161979, #162821, #162802, #161869. Thanks @VACInc and @obviyus and @ericcaiwx-star and @EndeavorPioneer and @jasdeepohri-max and @NickM83 and @609NFT.
- **PR #160193** Related #159941, #159477, #161979, #162821, #162802, #161869. Thanks @VACInc and @obviyus and @ericcaiwx-star and @grtninja and @EndeavorPioneer and @jasdeepohri-max and @NickM83 and @609NFT.
- **PR #160718** Related #159477, #161979, #162821, #162802, #161869. Thanks @VACInc and @obviyus and @ericcaiwx-star and @EndeavorPioneer and @jasdeepohri-max and @NickM83 and @609NFT.
- **PR #161260** Related #159477, #161979, #162821, #162802, #161869. Thanks @VACInc and @obviyus and @ericcaiwx-star and @EndeavorPioneer and @jasdeepohri-max and @NickM83 and @609NFT.
- **PR #160702** Related #159477, #161979, #162821, #162802, #161869. Thanks @RomneyDa and @VACInc and @obviyus and @ericcaiwx-star and @EndeavorPioneer and @jasdeepohri-max and @NickM83 and @609NFT.
- **PR #161946** Related #161929, #159477, #161979, #162821, #162802, #161869. Thanks @obviyus and @VACInc and @ericcaiwx-star and @saizero-dr and @EndeavorPioneer and @jasdeepohri-max and @NickM83 and @609NFT.
- **PR #161832** Related #161795, #159477, #161979, #162821, #162802, #161869. Thanks @ericcaiwx-star and @VACInc and @obviyus and @PennyVibe and @EndeavorPioneer and @jasdeepohri-max and @NickM83 and @609NFT.
- **PR #162321** Related #161979, #159477, #162821, #162802, #161869. Thanks @VACInc and @obviyus and @ericcaiwx-star and @jasdeepohri-max and @EndeavorPioneer and @NickM83 and @609NFT.
- **PR #162841** Related #162821, #159477, #161979, #162802, #161869. Thanks @VACInc and @obviyus and @ericcaiwx-star and @NickM83 and @EndeavorPioneer and @jasdeepohri-max and @609NFT.
- **PR #162912** Related #162802, #159477, #161979, #162821, #161869. Thanks @obviyus and @VACInc and @ericcaiwx-star and @609NFT and @EndeavorPioneer and @jasdeepohri-max and @NickM83.
- **PR #160137** Related #159477, #161979, #162821, #162802, #161869. Thanks @VACInc and @obviyus and @ericcaiwx-star and @EndeavorPioneer and @jasdeepohri-max and @NickM83 and @609NFT.
- **PR #162290** Related #159477, #161979, #162821, #162802, #161869. Thanks @VACInc and @obviyus and @ericcaiwx-star and @EndeavorPioneer and @jasdeepohri-max and @NickM83 and @609NFT.
- **PR #162304** Related #159477, #161979, #162821, #162802, #161869. Thanks @VACInc and @obviyus and @ericcaiwx-star and @EndeavorPioneer and @jasdeepohri-max and @NickM83 and @609NFT.
- **PR #162394** Related #161869, #159477, #161979, #162821, #162802. Thanks @VACInc and @obviyus and @ericcaiwx-star and @609NFT and @EndeavorPioneer and @jasdeepohri-max and @NickM83.
