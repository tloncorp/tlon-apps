import { ComponentChildren, JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';

import { sigilVNode } from './sigil';

/**
 * The primitive kit (plan §5): small, boring visual ports of the Tlon
 * look. Styling comes entirely from the token variables via the tsh-*
 * classes; nothing here may hardcode a color or font. Apps compose these —
 * the publish gate rejects styling outside them.
 */

type PressHandler = JSX.MouseEventHandler<HTMLElement>;

export function Card(props: { title?: string; children?: ComponentChildren }) {
  return (
    <div class="tsh-card">
      {props.title != null && <h2 class="tsh-card-title">{props.title}</h2>}
      {props.children}
    </div>
  );
}

export function ListRow(props: {
  left?: ComponentChildren;
  right?: ComponentChildren;
  children?: ComponentChildren;
}) {
  return (
    <div class="tsh-list-row">
      {props.left}
      <div class="tsh-list-row-content">{props.children}</div>
      {props.right}
    </div>
  );
}

export function Button(props: {
  onPress?: PressHandler;
  disabled?: boolean;
  tone?: 'neutral' | 'positive' | 'negative';
  children?: ComponentChildren;
}) {
  const tone =
    props.tone === 'positive' || props.tone === 'negative'
      ? ` tsh-button--${props.tone}`
      : '';
  return (
    <button
      class={`tsh-button${tone}`}
      disabled={props.disabled === true}
      onClick={props.disabled === true ? undefined : props.onPress}
    >
      {props.children}
    </button>
  );
}

export function Stat(props: { label: string; value: string; hint?: string }) {
  return (
    <div class="tsh-stat">
      <span class="tsh-stat-value">{props.value}</span>
      <span class="tsh-stat-label">{props.label}</span>
      {props.hint != null && <span class="tsh-stat-hint">{props.hint}</span>}
    </div>
  );
}

export function Badge(props: {
  tone?: 'neutral' | 'positive' | 'negative';
  children?: ComponentChildren;
}) {
  const tone =
    props.tone === 'positive' || props.tone === 'negative'
      ? ` tsh-badge--${props.tone}`
      : '';
  return <span class={`tsh-badge${tone}`}>{props.children}</span>;
}

export interface AvatarProps {
  /**
   * A point name (`~zod`, `~sampel-palnet`). Given one, the avatar draws
   * the real sigil, colored from the tokens — apps never touch sigil
   * rendering, the same posture as the chart primitive owning its
   * container (D58). A name the library cannot draw falls back to
   * initials rather than throwing.
   */
  ship?: string;
  /** used when there is no `ship`, or when its sigil cannot be drawn */
  initials?: string;
  color?: string;
}

/**
 * At most two characters, from `initials` when given and otherwise from
 * the ship name, so `<Avatar ship="~zod" />` still says something when the
 * name turns out not to be drawable.
 */
function avatarInitials(props: AvatarProps): string {
  if (typeof props.initials === 'string' && props.initials.length > 0) {
    return props.initials.slice(0, 2);
  }
  if (typeof props.ship === 'string') {
    return props.ship.replace(/^~/, '').slice(0, 2);
  }
  return '';
}

export function Avatar(props: AvatarProps) {
  // identity-blind by design: the shell knows nothing about contacts, so
  // the sigil's colors come from the token palette rather than from
  // per-ship contact metadata the sandbox cannot see. `color` tints the
  // box BEHIND the sigil — a frame, which is how small sigils read best.
  // It is expected to be a token variable reference; the style checker
  // keeps literals out of shell/app code.
  const sigil = sigilVNode(props.ship);
  return (
    <span
      class="tsh-avatar"
      style={props.color != null ? { background: props.color } : undefined}
    >
      {sigil ?? avatarInitials(props)}
    </span>
  );
}

export function Progress(props: { value: number; label?: string }) {
  const clamped = Number.isFinite(props.value)
    ? Math.min(1, Math.max(0, props.value))
    : 0;
  return (
    <div
      class="tsh-progress"
      role="progressbar"
      aria-label={props.label}
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div class="tsh-progress-fill" style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

export function EmptyState(props: { title: string; description?: string }) {
  return (
    <div class="tsh-empty-state">
      <span class="tsh-empty-state-title">{props.title}</span>
      {props.description != null && (
        <span class="tsh-empty-state-description">{props.description}</span>
      )}
    </div>
  );
}

export function SectionHeader(props: { children?: ComponentChildren }) {
  return <h3 class="tsh-section-header">{props.children}</h3>;
}

/* ------------------------------------------------------------------ */
/* Chart                                                               */
/*                                                                     */
/* The one primitive with a lifecycle. Everything else here is a pure  */
/* function of props; a chart owns a canvas, a Chart.js instance and a */
/* resize observer that all have to survive `render(state)` running    */
/* again. The primitive holds that so app bundles never do: they pass  */
/* DATA AND OPTIONS, never dimensions, and the container is what       */
/* decides how big the chart is.                                       */
/* ------------------------------------------------------------------ */

/** The slice of Chart.js the primitive uses; structurally typed so the
 * kit stays free of a hard chart.js import and the constructor can be
 * injected (the artifact ships it, unit tests stub it). */
export interface ChartInstance {
  data: unknown;
  options: unknown;
  update(mode?: string): void;
  destroy(): void;
}

export interface ChartLibraryDefaults {
  color?: unknown;
  borderColor?: unknown;
  font?: { family?: unknown };
}

export type ChartConstructor = (new (
  canvas: HTMLCanvasElement,
  config: { type: string; data: unknown; options: Record<string, unknown> }
) => ChartInstance) & { defaults?: ChartLibraryDefaults };

interface ChartDataset {
  backgroundColor?: unknown;
  borderColor?: unknown;
  [key: string]: unknown;
}

export interface ChartData {
  datasets?: ChartDataset[];
  [key: string]: unknown;
}

/** Named shapes, not pixels — see `.tsh-chart` in primitives.css. */
export type ChartSize = 'compact' | 'default' | 'tall';

export interface ChartProps {
  /** any Chart.js type registered in the shell: 'bar', 'line', … */
  type: string;
  data: ChartData;
  /** Chart.js options minus sizing, which the primitive owns */
  options?: Record<string, unknown>;
  size?: ChartSize;
  /** accessible name for the drawn canvas */
  label?: string;
}

/**
 * Series colors, in order, for datasets that declare none. Chart.js's own
 * fallback palette is a set of literals that ignore the host theme.
 */
const CHART_SERIES_TOKENS = [
  '--color-positive-text',
  '--color-negative-text',
  '--color-text-secondary',
  '--color-text-tertiary',
];

/**
 * Reads a token off the document the chart actually lives in — not a
 * module-global `document`, so the node fixture runner's own window works.
 */
function cssToken(node: Element, name: string): string | undefined {
  const doc = node.ownerDocument;
  const view = doc?.defaultView;
  if (view == null) {
    return undefined;
  }
  try {
    const value = view
      .getComputedStyle(doc.documentElement)
      .getPropertyValue(name)
      .trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Chart chrome (ticks, legend text, grid lines) follows the host theme. */
function applyChartTheme(constructor: ChartConstructor, node: Element) {
  const defaults = constructor.defaults;
  if (defaults == null) {
    return;
  }
  const ink = cssToken(node, '--color-text-secondary');
  const line = cssToken(node, '--color-border');
  const family = cssToken(node, '--font-family');
  if (ink !== undefined) {
    defaults.color = ink;
  }
  if (line !== undefined) {
    defaults.borderColor = line;
  }
  if (family !== undefined && defaults.font != null) {
    defaults.font.family = family;
  }
}

function withSeriesColors(data: ChartData, node: Element): ChartData {
  const datasets = data?.datasets;
  if (!Array.isArray(datasets)) {
    return data;
  }
  const palette: string[] = [];
  for (const name of CHART_SERIES_TOKENS) {
    const value = cssToken(node, name);
    if (value !== undefined) {
      palette.push(value);
    }
  }
  if (palette.length === 0) {
    return data;
  }
  return {
    ...data,
    datasets: datasets.map((dataset, index) => {
      if (
        dataset == null ||
        dataset.borderColor != null ||
        dataset.backgroundColor != null
      ) {
        return dataset;
      }
      const color = palette[index % palette.length];
      return { ...dataset, borderColor: color, backgroundColor: color };
    }),
  };
}

/**
 * The primitive owns sizing. `responsive`/`maintainAspectRatio` are
 * applied AFTER the caller's options on purpose: a bundle cannot opt back
 * into a fixed-size canvas through this door, which is the whole point —
 * the responsive path has to be the easy one.
 */
function chartOptions(
  options: Record<string, unknown> | undefined
): Record<string, unknown> {
  return {
    animation: false,
    ...(options ?? {}),
    responsive: true,
    maintainAspectRatio: false,
  };
}

/**
 * Binds the Chart primitive to a Chart.js constructor. Without one (the
 * chart-free harness tests) the primitive degrades to a labeled empty
 * state rather than throwing into the broken-state view.
 */
export function createChart(constructor: unknown) {
  const Ctor =
    typeof constructor === 'function'
      ? (constructor as ChartConstructor)
      : null;

  return function Chart(props: ChartProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<ChartInstance | null>(null);
    const typeRef = useRef<string | null>(null);

    const release = () => {
      const chart = chartRef.current;
      chartRef.current = null;
      typeRef.current = null;
      if (chart === null) {
        return;
      }
      try {
        chart.destroy();
      } catch {
        // a library that cannot tear itself down must not take the app's
        // render with it
      }
    };

    // Destroy runs exactly once, when the primitive leaves the tree. It is
    // its own mount-scoped effect so that re-rendering never tears the
    // instance down.
    useLayoutEffect(() => release, []);

    // Create on the first commit, update in place on every later one. The
    // canvas node is stable across renders (preact diffs it), so Chart.js
    // keeps its instance, its resize observer and its backing store.
    useLayoutEffect(() => {
      const canvas = canvasRef.current;
      if (Ctor === null || canvas === null) {
        return;
      }
      applyChartTheme(Ctor, canvas);
      const config = {
        type: props.type,
        data: withSeriesColors(props.data, canvas),
        options: chartOptions(props.options),
      };
      const chart = chartRef.current;
      // a chart type change is a rebuild — Chart.js cannot swap
      // controllers in place
      if (chart !== null && typeRef.current === props.type) {
        try {
          chart.data = config.data;
          chart.options = config.options;
          chart.update('none');
          return;
        } catch {
          // Chart.js only degrades cleanly on CONSTRUCTION: with no 2D
          // context, `update` throws. This effect runs inside the
          // harness's render, so an escaping throw would replace the whole
          // app with the broken state. Fall back to a rebuild instead.
        }
      }
      release();
      try {
        chartRef.current = new Ctor(canvas, config);
        typeRef.current = props.type;
      } catch {
        // an unbuildable chart is an empty box, not a broken app; the next
        // render tries again
      }
    });

    if (Ctor === null) {
      return (
        <EmptyState
          title="Chart.js is not available"
          description="This shell was built without the charting library."
        />
      );
    }

    const size =
      props.size === 'compact' || props.size === 'tall'
        ? ` tsh-chart--${props.size}`
        : '';
    return (
      <div class={`tsh-chart${size}`}>
        <canvas ref={canvasRef} role="img" aria-label={props.label} />
      </div>
    );
  };
}

/**
 * The harness's defined broken-state view: rendered in place of app output
 * when the bundle's render throws, so a crashing app is a labeled box, not
 * a white screen. Built from primitives so it obeys the same tokens.
 */
export function BrokenState(props: { detail?: string }) {
  return (
    <div class="tsh-broken">
      <span class="tsh-empty-state-title">This app hit an error</span>
      {props.detail != null && (
        <div class="tsh-empty-state-description">{props.detail}</div>
      )}
    </div>
  );
}

export const primitives = {
  Card,
  ListRow,
  Button,
  Stat,
  Badge,
  Avatar,
  Progress,
  EmptyState,
  SectionHeader,
} as const;

export type Primitives = typeof primitives;

/**
 * The kit an app bundle actually sees. Everything in `primitives` is a
 * pure component and can be shared; `Chart` is bound per shell to the
 * Chart.js constructor that shell was given.
 */
export function createPrimitiveKit(chart?: unknown) {
  return { ...primitives, Chart: createChart(chart) };
}

export type PrimitiveKit = ReturnType<typeof createPrimitiveKit>;
