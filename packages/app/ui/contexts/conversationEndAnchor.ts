export type ConversationScrollEndAnchorHandler = {
  capture: () => void;
  restore: () => void;
  /** Reconcile a completed synchronous DOM change without starting new intent. */
  layoutChanged?: () => void;
};

/** A restore belongs to the registration that captured it, even across ABA. */
export function createConversationEndAnchorRegistry() {
  type Registration = { handler: ConversationScrollEndAnchorHandler };
  let current: Registration | null = null;
  let captured: Registration | null = null;
  return {
    layoutChanged() {
      current?.handler.layoutChanged?.();
    },
    capture() {
      captured = current;
      current?.handler.capture();
    },
    register(handler: ConversationScrollEndAnchorHandler) {
      const registration = { handler };
      current = registration;
      captured = null;
      return () => {
        if (current === registration) current = null;
        if (captured === registration) captured = null;
      };
    },
    restore() {
      const owner = captured;
      captured = null;
      if (owner && owner === current) owner.handler.restore();
    },
  };
}
