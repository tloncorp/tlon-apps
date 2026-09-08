export type PostTargetDecoration = { leading: boolean; trailing: boolean };
export type PostTargetLayoutPart =
  | 'cell'
  | 'leading-divider'
  | 'leading-separator'
  | 'trailing-separator';
export type PostTargetLayoutRegistry = ReturnType<
  typeof createPostTargetLayoutRegistry
>;

/** Native compact-flow decoration owned by the actual ScrollerItem lifetime. */
export function createPostTargetLayoutRegistry(
  scope: string,
  schedule: (callback: () => void) => unknown = requestAnimationFrame
) {
  type Geometry = { cell: number; leading: number; trailing: number };
  type Owner = { active: boolean; published?: Geometry };
  const owners = new Map<string, Set<Owner>>();
  return {
    scope,
    get(key: string, itemSize: number, nativePixelRatio?: number) {
      const matches = owners.get(key);
      if (matches?.size !== 1 || !Number.isFinite(itemSize) || itemSize <= 0)
        return undefined;
      const owner = [...matches][0];
      const geometry = owner.published;
      if (!owner.active || !geometry) return undefined;
      // Legend first suppresses native updates within one device pixel +0.01
      // of sizesKnown; only accepted updates are floored to eighth-points.
      // Match that renderer policy while retaining the current host lease.
      // cellSizeDelta below still corrects the retained index size exactly.
      const retainedSizeLimit =
        nativePixelRatio !== undefined &&
        Number.isFinite(nativePixelRatio) &&
        nativePixelRatio > 0
          ? 1 / nativePixelRatio + 0.01
          : NaN;
      const isRetainedNativeSize =
        Number.isFinite(retainedSizeLimit) &&
        Math.floor(itemSize * 8) / 8 === itemSize &&
        Math.abs(geometry.cell - itemSize) <= retainedSizeLimit;
      if (
        Math.floor(geometry.cell * 8) / 8 !== itemSize &&
        !isRetainedNativeSize
      )
        return undefined;
      return {
        leading: geometry.leading,
        trailing: geometry.trailing,
        cellSizeDelta: itemSize - geometry.cell,
      };
    },
    createLease(
      rowScope: string,
      key: string,
      decoration: PostTargetDecoration
    ) {
      const owner: Owner = { active: false };
      const parts: Partial<Record<PostTargetLayoutPart, number>> = {};
      let activated = false;
      let epoch = 0;
      let queued = false;
      const publish = () => {
        owner.published = undefined;
        if (
          !owner.active ||
          queued ||
          parts.cell === undefined ||
          (decoration.leading &&
            (parts['leading-divider'] === undefined ||
              parts['leading-separator'] === undefined)) ||
          (decoration.trailing && parts['trailing-separator'] === undefined)
        )
          return;
        queued = true;
        const ticket = epoch;
        schedule(() => {
          if (ticket !== epoch) return;
          queued = false;
          if (!owner.active) return;
          const cell = parts.cell;
          const leading = decoration.leading
            ? (parts['leading-divider'] ?? NaN) +
              (parts['leading-separator'] ?? NaN)
            : 0;
          const trailing = decoration.trailing
            ? parts['trailing-separator']
            : 0;
          if (
            typeof cell === 'number' &&
            cell > 0 &&
            Number.isFinite(leading) &&
            leading >= 0 &&
            typeof trailing === 'number' &&
            Number.isFinite(trailing) &&
            trailing >= 0 &&
            leading + trailing < cell
          )
            owner.published = { cell, leading, trailing };
        });
      };
      return {
        invalidate() {
          owner.published = undefined;
          epoch++;
          queued = false;
          for (const part of Object.keys(parts) as PostTargetLayoutPart[])
            delete parts[part];
        },
        activate() {
          if (owner.active || rowScope !== scope || !key) return;
          activated = true;
          owner.active = true;
          epoch++;
          const matches = owners.get(key) ?? new Set<Owner>();
          matches.add(owner);
          owners.set(key, matches);
          publish();
        },
        deactivate() {
          owner.active = false;
          owner.published = undefined;
          epoch++;
          queued = false;
          const matches = owners.get(key);
          matches?.delete(owner);
          if (matches?.size === 0) owners.delete(key);
        },
        layout(part: PostTargetLayoutPart, height: number) {
          if (activated && !owner.active) return;
          if (
            part !== 'cell' &&
            (part === 'trailing-separator'
              ? !decoration.trailing
              : !decoration.leading)
          )
            return;
          const next =
            Number.isFinite(height) && height >= 0 ? height : undefined;
          if (parts[part] === next) return;
          parts[part] = next;
          publish();
        },
      };
    },
  };
}
