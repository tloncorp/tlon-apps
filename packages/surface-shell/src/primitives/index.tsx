import { ComponentChildren, JSX } from 'preact';

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

export function Avatar(props: { initials: string; color?: string }) {
  // identity-blind by design: initials and color come from the caller;
  // the shell knows nothing about contacts. `color` is expected to be a
  // token variable reference; the style checker keeps literals out of
  // shell/app code.
  return (
    <span
      class="tsh-avatar"
      style={props.color != null ? { background: props.color } : undefined}
    >
      {props.initials.slice(0, 2)}
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
