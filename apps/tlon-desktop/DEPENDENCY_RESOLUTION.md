# Dependency Resolution for Electron in pnpm Monorepos

This document explains how we handle dependency resolution for Electron builds in our pnpm monorepo.

## The Problem

When building Electron apps in a pnpm monorepo, electron-builder often encounters issues with dependency resolution. This typically manifests as errors like:

```
dependency path is undefined  packageName=some-package data=[object Object] parentModule=parent-package parentVersion=1.0.0
```

This happens because electron-builder has trouble parsing pnpm's symlink-based node_modules structure. While this issue was initially observed with native modules like better-sqlite3, it can affect any dependency in the monorepo.

## The Solution: flatten-dependencies.js

Our solution uses a thorough recursive approach:

- Scans the entire node_modules directory to build a complete dependency map
- Recursively resolves all dependencies AND devDependencies
- Creates a flat dependency structure by copying only required modules to app's node_modules

It's integrated into the build process via the package.json script:

```json
"build": "pnpm run build:ts && pnpm run build:web && pnpm run flatten-deps && electron-builder"
```

## How flatten-dependencies.js Works

1. **Scan all dependencies**: Finds every package in the monorepo's node_modules
2. **Resolve recursive dependencies**: Starts with the app's package.json and recursively resolves all dependencies and devDependencies
3. **Copy required dependencies**: Copies only the necessary dependencies to app's node_modules directory

The script also explicitly adds some "magic dependencies" that electron-builder needs but aren't detected through normal dependency resolution:

```javascript
// Explicitly add some dependencies needed by ajv
const explicitlyNeeded = ['require-from-string', 'fast-uri'];
```

## Troubleshooting

If you encounter new dependency errors during packaging:

1. Look for "dependency path is undefined" errors in the build output
2. Add any missing packages to the `explicitlyNeeded` array
3. Run the build again to verify the dependencies are properly included
