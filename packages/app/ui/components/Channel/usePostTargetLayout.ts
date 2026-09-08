import { useLayoutEffect, useMemo, useRef } from 'react';
import type { View } from 'react-native';

import type {
  PostTargetLayoutPart,
  PostTargetLayoutRegistry,
} from './postTargetLayout';

type Frame = [number, number, number, number, number, number];

/** Reads current host geometry; onLayout is an invalidation signal, not a snapshot. */
export function usePostTargetLayout({
  registry,
  scope,
  rowKey,
  leading,
  trailing,
}: {
  registry?: PostTargetLayoutRegistry;
  scope: string;
  rowKey: string;
  leading: boolean;
  trailing: boolean;
}) {
  // Tamagui retains its first composed forwarded ref. These handles and
  // callbacks belong to the physical component, not a logical row lease.
  const physicalHosts = useRef<Partial<Record<PostTargetLayoutPart, View>>>({});
  const committed = useRef<{ refresh: () => void } | undefined>(undefined);
  const session = useMemo(() => {
    if (!registry) return undefined;
    const lease = registry.createLease(scope, rowKey, { leading, trailing });
    const required: PostTargetLayoutPart[] = ['cell'];
    if (leading) required.push('leading-divider', 'leading-separator');
    if (trailing) required.push('trailing-separator');
    const hosts = physicalHosts.current;
    let active = false;
    let generation = 0;
    const invalidate = () => {
      generation++;
      lease.invalidate();
    };
    const refresh = () => {
      invalidate();
      if (!active || required.some((part) => !hosts[part])) return;
      const ticket = generation;
      const captured = { ...hosts };
      const current = () =>
        active &&
        ticket === generation &&
        required.every((part) => captured[part] === hosts[part]);
      const values: Partial<Record<PostTargetLayoutPart, number>> = {};
      const read = (
        part: PostTargetLayoutPart,
        next: (frame: Frame) => void
      ) => {
        if (!current()) return;
        try {
          captured[part]!.measure((...frame: Frame) => {
            if (!current()) return;
            if (
              frame.some((value) => !Number.isFinite(value)) ||
              frame[2] <= 0 ||
              frame[3] <= 0
            )
              return;
            next(frame);
          });
        } catch {
          // A detached/unavailable host cannot contribute a prior measurement.
          if (current()) invalidate();
        }
      };
      read('cell', (first) => {
        values.cell = first[3];
        const collect = (index: number) => {
          if (!current()) return;
          if (index < required.length) {
            const part = required[index];
            read(part, (frame) => {
              values[part] = frame[3];
              collect(index + 1);
            });
            return;
          }
          read('cell', (last) => {
            if (!first.every((value, index) => value === last[index])) return;
            for (const part of required) lease.layout(part, values[part]!);
          });
        };
        collect(1);
      });
    };
    return {
      refresh,
      activate() {
        active = true;
        lease.activate();
      },
      deactivate() {
        active = false;
        invalidate();
        lease.deactivate();
      },
    };
  }, [registry, scope, rowKey, leading, trailing]);
  const bindings = useMemo(() => {
    const refresh = () => committed.current?.refresh();
    const binding = (part: PostTargetLayoutPart) => ({
      ref: (host: View | null) => {
        const hosts = physicalHosts.current;
        if (hosts[part] === host) return;
        if (host) hosts[part] = host;
        else delete hosts[part];
        refresh();
      },
      onLayout: refresh,
    });
    return {
      cell: binding('cell'),
      divider: binding('leading-divider'),
      leadingSeparator: binding('leading-separator'),
      trailingSeparator: binding('trailing-separator'),
      refresh,
    };
  }, []);
  useLayoutEffect(() => {
    committed.current = session;
    session?.activate();
    return () => {
      if (committed.current === session) committed.current = undefined;
      session?.deactivate();
    };
  }, [session]);
  // Also refresh same-height commits: the host need not emit another onLayout.
  useLayoutEffect(() => {
    session?.refresh();
  });
  // Install refs even when disabled, so a later lease can acquire retained hosts.
  // With no committed session the stable callbacks never measure or publish.
  return bindings;
}
