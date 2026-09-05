// Side-effect module: imported by main.tsx directly after expo-polyfill so
// Sentry exists before any application module evaluates.
import { initSentry } from './sentry-bootstrap';

initSentry();
