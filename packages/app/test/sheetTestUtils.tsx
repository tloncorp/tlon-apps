import React from 'react';
import { afterAll, beforeAll, vi } from 'vitest';

/**
 * The sheet suites render with react-test-renderer in vitest's node
 * environment. Sources compile to classic JSX there, so React must be a
 * global, and `act` needs the environment flag.
 */
export function setupReactTestEnvironment() {
  beforeAll(() => {
    vi.stubGlobal('React', React);
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });
}

/** Renders its children, and a sheet's `trigger`, and nothing else. */
export const Passthrough = ({
  children,
  trigger,
}: {
  children?: React.ReactNode;
  trigger?: React.ReactNode;
}) => (
  <>
    {trigger}
    {children}
  </>
);

export const Empty = () => null;

/** Stands in for `createActionGroups` when the ActionSheet module is mocked. */
export const createActionGroups = (
  ...groups: ([string, ...unknown[]] | false)[]
) =>
  groups.filter(Boolean).map((group) => {
    const [accent, ...actions] = group as [string, ...unknown[]];
    return { accent, actions: actions.filter(Boolean) };
  });

export const ListItem = Object.assign(Passthrough, {
  EndContent: Passthrough,
  MainContent: Passthrough,
  Subtitle: Passthrough,
  SystemIcon: Empty,
  Title: Passthrough,
});
