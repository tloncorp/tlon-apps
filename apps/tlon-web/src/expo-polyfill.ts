// This file must be imported as the very first import in main.tsx.
// It ensures globalThis.expo is set up before any expo modules load.
//
// In Vite's production build (Rollup), the .web.ts index files in
// expo-modules-core/src/polyfill are not correctly resolved, causing
// the polyfill to be tree-shaken. This explicit side-effect import
// ensures the polyfill runs during module initialization (before
// main.tsx's body executes).
import { installExpoGlobalPolyfill } from 'expo-modules-core/src/polyfill/dangerous-internal';

installExpoGlobalPolyfill();
