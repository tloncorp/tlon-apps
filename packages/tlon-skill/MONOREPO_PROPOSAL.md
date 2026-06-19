# Monorepo Proposal for Tlon Tools

**Date:** 2026-02-17  
**Status:** Discussion with team

## Current Pain Points

1. Cross-repo dependency management - pointing to git branches, waiting for merges
2. Testing friction - local `file:` refs, remembering to change back
3. Related changes split across multiple PRs
4. Version coordination between packages

## Proposed Structure

**Monorepo (public):** `tlon-tools` or similar
```
packages/
  api/           # @tloncorp/api (currently api-beta)
  skill/         # @tloncorp/tlon-skill  
  openclaw/      # openclaw-tlon plugin
```

**Separate (private):**
```
tlonbot/         # prompts, personality, deployment config
  └── depends on @tloncorp/tlon-skill (npm)
```

## Benefits

- Single PR for related changes across api/skill/plugin
- Workspace linking just works (pnpm/npm workspaces)
- CI tests everything together
- Atomic versioning
- Shared tooling (TypeScript config, linting, build scripts)

## tlonbot Stays Separate

- Private/proprietary content (prompts, personality)
- Deployment-specific, not a library
- Different access control needs
- Stays lean - just consumes published packages

## Open Questions

- What's the long-term plan for api-beta vs upstream @tloncorp/api?
- Who needs access to what?
- Release cadence alignment?

## Next Steps

- [ ] Discuss with team
- [ ] Decide on repo name/location
- [ ] Migration plan if approved
