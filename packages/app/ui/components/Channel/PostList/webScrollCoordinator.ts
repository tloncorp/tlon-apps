/** The DOM adapter supplies coherent, synchronous measurements. */
export interface WebReadingPoint {
  measure: () => number | null;
  elements?: Element[];
}

export interface WebScrollSurface {
  offset: () => number;
  maximum: () => number;
  write: (offset: number, animated: boolean) => void;
  capture: () => WebReadingPoint[];
  visible: () => boolean;
  onIntentChanged?: () => void;
}

type ReadingSnapshot = {
  offset: number;
  points: Array<{ point: WebReadingPoint; y: number }>;
};

/**
 * One owner for end maintenance, reading restoration and explicit navigation.
 * Proximity is a measurement, never permission to resume following messages.
 */
export class WebScrollCoordinator {
  private alive = true;
  private revision = 0;
  private scope = '';
  private atEnd = true;
  private followBlocked = false;
  private hidden = false;
  private focused = true;
  private mode: 'follow' | 'read' | 'target' = 'read';
  private snapshot: ReadingSnapshot | null = null;
  private lastOffset: number;
  private lastMaximum: number;
  private expectedOffset: number | null = null;
  private userScrolling = false;
  private target: {
    measure: () => number | null;
    followAfter: boolean;
    destination: number;
  } | null = null;

  constructor(private readonly surface: WebScrollSurface) {
    this.lastOffset = surface.offset();
    this.lastMaximum = surface.maximum();
  }

  configure(scope: string, atEnd: boolean, followBlocked: boolean) {
    this.followBlocked = followBlocked;
    this.atEnd = atEnd;
    if (scope !== this.scope) {
      this.revoke();
      this.scope = scope;
      this.mode = 'read';
      this.snapshot = null;
      this.lastOffset = this.surface.offset();
      this.lastMaximum = this.surface.maximum();
    }
  }

  captureScrollIntent = () => {
    const revision = this.revision;
    return () =>
      this.alive &&
      this.focused &&
      !this.hidden &&
      this.surface.visible() &&
      this.revision === revision;
  };

  /** Route cover retains the reader; it is distinct from document visibility. */
  setFocused(focused: boolean) {
    if (focused === this.focused) return;
    if (!focused) {
      // FOLLOW keeps no standing snapshot; TARGET may have moved since its last
      // snapshot. Capture the current visible point before retiring either.
      if (this.mode !== 'read' || !this.snapshot) this.remember();
      this.revoke();
      this.mode = 'read';
      this.userScrolling = false;
    }
    this.focused = focused;
    this.lastOffset = this.surface.offset();
    this.lastMaximum = this.surface.maximum();
  }

  dispose() {
    this.revoke();
    this.alive = false;
    this.snapshot = null;
  }

  private revoke(notify = false) {
    this.revision++;
    if (this.target) {
      // Interrupt the browser's outstanding smooth movement as well as JS work.
      this.surface.write(this.surface.offset(), false);
    }
    this.target = null;
    this.expectedOffset = null;
    if (notify) this.surface.onIntentChanged?.();
  }

  /** Called on list input, before the browser applies its default scrolling. */
  userInput(direction: number) {
    if (!this.alive || !this.focused || !this.surface.visible()) return;
    this.revoke(true);
    this.userScrolling = true;
    this.mode =
      direction !== 0 &&
      (this.atEnd ? direction > 0 : direction < 0) &&
      this.isAtEdge()
        ? 'follow'
        : 'read';
    this.remember();
  }

  endUserInput() {
    this.userScrolling = false;
  }

  /** Scroll events include our own writes; those must not renew user authority. */
  scrolled() {
    if (!this.alive || !this.focused) return;
    if (this.acceptPassiveEndClamp()) return;
    const offset = this.surface.offset();
    const movement = offset - this.lastOffset;
    this.lastOffset = offset;
    if (this.target) {
      if (Math.abs(offset - this.target.destination) <= 1) {
        this.mode = this.target.followAfter ? 'follow' : 'read';
        this.target = null;
        this.remember();
      }
      return;
    }
    if (
      this.expectedOffset !== null &&
      Math.abs(offset - this.expectedOffset) <= 1
    ) {
      this.expectedOffset = null;
      return;
    }
    this.expectedOffset = null;
    if (Math.abs(movement) < 0.01) return;
    if (!this.userScrolling) this.revoke(true);
    // Only actual movement toward the end may resume FOLLOW. Content shrinking
    // close to the end cannot do so, and old send validators stay revoked.
    this.mode =
      this.userScrolling &&
      (this.atEnd ? movement > 0 : movement < 0) &&
      this.isAtEdge()
        ? 'follow'
        : 'read';
    this.remember();
  }

  visibilityChanged() {
    if (!this.focused) return;
    const hidden = !this.surface.visible();
    if (hidden && !this.hidden) {
      this.revoke();
      this.mode = 'read';
      this.snapshot = null;
    }
    this.hidden = hidden;
  }

  navigate(
    measure: () => number | null,
    animated: boolean,
    followAfter = false,
    notify = true
  ) {
    if (!this.alive || !this.focused || !this.surface.visible()) return;
    this.revoke(notify);
    this.userScrolling = false;
    const offset = measure();
    if (offset === null || !Number.isFinite(offset)) return;
    this.mode = animated ? 'target' : followAfter ? 'follow' : 'read';
    const destination = this.clamp(offset);
    if (animated && Math.abs(destination - this.surface.offset()) > 1) {
      this.target = { measure, followAfter, destination };
    } else {
      this.mode = followAfter ? 'follow' : 'read';
    }
    this.write(destination, animated);
    if (!this.target) this.remember();
  }

  goToEdge(animated: boolean, notify = true) {
    this.navigate(
      () => (this.atEnd ? this.surface.maximum() : 0),
      animated,
      true,
      notify
    );
  }

  reconcile() {
    if (!this.alive || !this.focused) return;
    this.visibilityChanged();
    if (this.hidden) return;
    this.acceptPassiveEndClamp();
    if (this.userScrolling && this.snapshot) {
      // Wheel default scrolling can precede its scroll event and a simultaneous
      // image layout notification. Preserve that displacement without sampling
      // the already-mutated glyph as the old reading position.
      const displacement = this.surface.offset() - this.lastOffset;
      if (Math.abs(displacement) > 0.01) {
        this.snapshot.offset += displacement;
        for (const point of this.snapshot.points) point.y -= displacement;
        this.lastOffset = this.surface.offset();
      }
    }
    if (this.target) {
      const offset = this.target.measure();
      if (offset === null || !Number.isFinite(offset)) {
        this.revoke();
        this.mode = 'read';
        this.remember();
      } else {
        const destination = this.clamp(offset);
        if (Math.abs(destination - this.target.destination) > 0.01) {
          this.target.destination = destination;
          this.write(destination, true);
        }
      }
      return;
    }
    if (this.mode === 'follow' && !this.followBlocked) {
      this.write(this.atEnd ? this.surface.maximum() : 0, false);
      // READ captures on input. Avoid walking visible rich content on every
      // delivery/typing/resize update while the user is following the end.
      this.snapshot = null;
      return;
    }
    const snapshot = this.snapshot;
    if (!snapshot) {
      this.remember();
      return;
    }
    for (const { point, y } of snapshot.points) {
      const current = point.measure();
      if (current === null || !Number.isFinite(current)) continue;
      this.write(this.surface.offset() + current - y, false);
      // Rebase after legal-range clamping. Repeated notifications must not keep
      // trying to reach an impossible position or manufacture a new FOLLOW.
      this.refreshSnapshot(snapshot);
      return;
    }
    this.write(snapshot.offset, false);
    this.remember();
  }

  get observedElements(): Element[] {
    return (
      this.snapshot?.points.flatMap(({ point }) => point.elements ?? []) ?? []
    );
  }

  private refreshSnapshot(snapshot: ReadingSnapshot) {
    this.snapshot = {
      offset: this.surface.offset(),
      points: snapshot.points.flatMap(({ point }) => {
        const y = point.measure();
        return y === null || !Number.isFinite(y) ? [] : [{ point, y }];
      }),
    };
  }

  private remember() {
    this.refreshSnapshot({
      offset: this.surface.offset(),
      points: this.surface.capture().map((point) => ({ point, y: 0 })),
    });
  }

  /** Browser range clamping preserves an existing FOLLOW owner. */
  private acceptPassiveEndClamp() {
    const maximum = Math.max(0, this.surface.maximum());
    const previousMaximum = this.lastMaximum;
    this.lastMaximum = maximum;
    const offset = this.surface.offset();
    if (
      this.mode !== 'follow' ||
      this.userScrolling ||
      !this.atEnd ||
      this.target !== null ||
      maximum >= previousMaximum - 0.01 ||
      this.lastOffset <= maximum + 0.01 ||
      Math.abs(offset - maximum) > 1
    )
      return false;
    // The old offset became illegal and the browser moved it to the new end.
    // This grants no new authority: real upward input already entered READ,
    // and neither the intent revision nor any captured permit is reset here.
    this.lastOffset = offset;
    this.expectedOffset = offset;
    return true;
  }

  private isAtEdge() {
    return (
      Math.abs(
        this.surface.offset() - (this.atEnd ? this.surface.maximum() : 0)
      ) <= 1
    );
  }

  private clamp(offset: number) {
    return Math.max(0, Math.min(Math.max(0, this.surface.maximum()), offset));
  }

  private write(offset: number, animated: boolean) {
    const destination = this.clamp(offset);
    if (Math.abs(destination - this.surface.offset()) <= 0.01) return;
    this.expectedOffset = destination;
    this.surface.write(destination, animated);
    this.lastOffset = this.surface.offset();
  }
}
