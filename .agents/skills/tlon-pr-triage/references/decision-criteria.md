# Tlon decision criteria

This is the initial advisory policy for local triage. It routes review work; it
does not grant merge permission or replace repository requirements.

## Complexity

Estimate the number of interacting behaviors and invariants, not just lines:

- **Low:** a localized behavior with a small, understood set of consumers.
- **Medium:** coordinated changes across components or a stateful flow, with
  identifiable boundaries and manageable validation.
- **High:** several interacting contracts, asynchronous lifecycle changes,
  concurrency, migrations, or coordination across clients and deployed versions.

Use changed functions, callers, shared state, supported platforms, and release
boundaries as evidence. File count and churn are supporting signals. Separate
generated content and mechanical edits from behavioral changes; review the
generator and its consumers when relevant. Many review rounds can reveal
unsettled assumptions, but are not themselves proof that a human is needed.

## Sensitivity and domain context

| Changed surface                                      | Questions that affect the rating                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| UI, copy, and local components                       | Is behavior local? Are accessibility or onboarding affected? Is the text making a privacy, security, or durability promise?            |
| Navigation and shared components                     | Which viewports and platforms consume it? What happens to persisted routes, deep links, and existing sessions?                         |
| Store, cache, and sync                               | Which writes refresh which readers? What happens during reconnects, retries, concurrent events, or partial state?                      |
| Schema, migrations, and storage                      | Can existing data be lost or reinterpreted? Can the old client read the resulting state? Does reverting code actually undo the effect? |
| API requests and desk contracts                      | Are request/response shapes or capabilities changing? Which released clients and desks must interoperate?                              |
| Permissions and identity                             | Whose authority is used? Who can trigger the operation? Are owner, bot, member, host, or admin boundaries changing?                    |
| CI, dependencies, publishing, and agent instructions | Are executable code, credentials, artifact provenance, deployment authority, or review policy changing?                                |

Rate sensitivity **low** for limited, reversible consequences; **medium** for
meaningful user-facing or shared-state impact with a bounded recovery path;
**high** for authority, confidentiality, persistent-data, or broad compatibility
impact. High sensitivity requires an explicit human-boundary check below.

Tlon-specific investigation routes:

- For cache claims, read `docs/tlon-apps/db-react-query.md` and the actual
  invalidation path. Library defaults are insufficient here.
- For navigation, trace the active navigator and relevant viewport/native
  branches. An extension or directory name alone does not establish coverage.
- For desk compatibility, consult `docs/tlon-apps/desk-compatibility.md`,
  `oxlint/desk-request-scope.json`, and affected entries under
  `packages/api/src/client/requests/`. Check deployed-version assumptions,
  including any exemption, before calling a missing guard a defect.
- For backend claims, read the relevant `docs/backend/` documentation and Hoon
  source. Compilation evidence must satisfy the repository's assembly, commit,
  and explicit file-build requirements where applicable.
- Documentation, skills, templates, and prompts can change runtime agent
  behavior. Do not classify them as harmless solely because they are Markdown.

## Human boundaries

Require human review when the change:

- Materially grants, broadens, or reassigns authority, changes authentication
  boundaries, or changes who can access private data.
- Introduces a destructive migration, deletion policy, or persistent-data
  transformation whose loss or rollback cannot be safely bounded.
- Breaks a supported protocol or contract, or requires an explicit decision
  about release order or ending support for older clients/desks.
- Changes the authority to use secrets, publish artifacts, deploy, or decide
  whether human review is required, including this triage policy.
- Requires an unresolved product decision or acceptance of a consequential known
  defect rather than implementation of an established requirement.

A path match alone does not cross these boundaries. Correcting a label in a
permissions screen, adding a regression test, or using an already approved
contract can still be agent work. Explain the actual semantic change.

For an existing human decision, cite what was decided and establish that the
current revision remains within it. Do not infer acceptance from a resolved
thread, merge, automated reply, or approval submitted through a shared account.
If the user explicitly changes this advisory policy, state the deviation and its
scope; do not silently rewrite the skill.

## Evidence and routing

Evidence is **sufficient** only for the assessed behavior and revision. Identify
untested branches that could change the recommendation. Mark evidence
**partial** when some relevant cases were inspected or tested and others remain;
mark it **missing** when the necessary proof is unavailable.

Tests can settle a technical claim but cannot decide intended authority or
acceptable data loss. Two agents agreeing is not independent behavioral proof.
Conversely, a confirmed bug with a clear, bounded correction does not inherently
require human intervention.

Apply mandatory human boundaries first. Otherwise, missing evidence means
`incomplete`; established, bounded corrections mean `agent-work-needed`; and
only an adequately verified change with no material work outstanding is
`agent-eligible`. Do not convert missing CI access into a clean result or a
speculative defect.
