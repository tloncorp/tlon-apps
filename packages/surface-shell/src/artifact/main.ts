import { Chart, registerables } from 'chart.js';

import '../tokens/tokens.css';
import '../primitives/primitives.css';
import { createSurfaceShell } from '../harness/index';
import { SHELL_VERSION } from '../version';

/**
 * The sandbox artifact entry: everything the host injects into the
 * webview/iframe ahead of the app bundle. Builds to a single IIFE JS file
 * plus one CSS file (vite lib mode, no dynamic imports — the sandbox
 * forbids them).
 */

Chart.register(...registerables);

declare global {
  interface Window {
    __TLON_SURFACE_SHELL_VERSION?: number;
  }
}

window.__TLON_SURFACE_SHELL_VERSION = SHELL_VERSION;

createSurfaceShell({ window, chart: Chart });
