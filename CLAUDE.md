# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building
- `pnpm run build:all` - Build all packages and applications
- `pnpm run build:packages` - Build shared packages only (shared, ui, editor)
- `pnpm run build:web` - Build web application  
- `pnpm run build:mobile` - Build mobile application
- `pnpm run build:desktop` - Build desktop application

### Development
- `pnpm run dev:web` - Start web development server
- `pnpm run dev:ios` - Start iOS development with live reload
- `pnpm run dev:android` - Start Android development with live reload
- `pnpm run dev:desktop` - Start desktop development

### Testing
- `pnpm run test` - Run all tests with updates
- `pnpm run test:ci` - Run all tests in CI mode
- `pnpm run e2e` - Run end-to-end tests (web)

### Linting
- `pnpm run lint:all` - Run linting across all packages
- `pnpm lint:fix` - Fix linting issues (per package)
- `pnpm lint:format` - Format code with prettier (per package)

### Installing Dependencies
- `pnpm install` - Install all dependencies
- `pnpm run deps` - Install dependencies including iOS pods

## Architecture Overview

This is a monorepo for Tlon Messenger containing multiple applications and shared packages:

### Applications
- **tlon-web**: Web application built with React, TypeScript, and Vite
- **tlon-mobile**: React Native application for iOS and Android using Expo
- **tlon-desktop**: Electron desktop application wrapping the web app

### Shared Packages
- **packages/shared**: Core business logic, API clients, database schema, and state management
- **packages/ui**: Shared UI components using Tamagui
- **packages/app**: App-specific components and navigation
- **packages/editor**: Rich text editor components

### Backend
- **desk/**: Urbit backend applications written in Hoon
  - Core agents: %groups, %channels, %chat, %contacts, %activity, %profile

## Key Technologies

- **Frontend**: React, TypeScript, React Native, Expo, Electron
- **UI**: Tamagui, Tailwind CSS
- **State Management**: Zustand, React Query
- **Database**: SQLite (web: SQLocal, mobile: op-sqlite, desktop: better-sqlite3)
- **Backend**: Urbit (Hoon)
- **Build**: Vite, Metro, pnpm workspaces

## Development Workflow

1. Install dependencies: `pnpm install`
2. Build packages: `pnpm run build:packages`
3. Start development server for your target platform
4. Use `pnpm run cosmos` for component development

### Mobile Development
- Requires iOS/Android development environment
- Uses Expo for development builds
- Run `pnpm run deps:ios` for iOS pod installation

### Web Development
- Requires `.env.local` file in `apps/tlon-web` with `VITE_SHIP_URL`
- Supports hot reloading via Vite

### Desktop Development
- Builds on top of web application
- Uses Electron for native desktop features

## Testing

- **Unit tests**: Vitest for shared packages, Jest for mobile
- **E2E tests**: Playwright for web application
- **UI tests**: React Cosmos for component testing

## Package Dependencies

The monorepo uses a dependency hierarchy:
- Apps depend on packages (shared, ui, app, editor)
- Packages can depend on each other (app → shared, ui → shared)
- Shared package is the foundation with no internal dependencies

## Backend Integration

The frontend communicates with Urbit backend through:
- HTTP API via `@urbit/http-api`
- Server-sent events for real-time updates
- Custom API layer in `packages/shared/src/api/`

## Database Schema

Uses Drizzle ORM with SQLite for local data storage:
- Schema defined in `packages/shared/src/db/schema.ts`
- Migrations in `packages/shared/src/db/migrations/`
- Platform-specific database connections in `packages/shared/src/db/`