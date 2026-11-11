import { describe, expect, it, vi } from 'vitest';

import { activateAgentControlFromKeyboard } from './keyboardControl';

describe('activateAgentControlFromKeyboard', () => {
  it.each(['Enter', ' '])('activates for %j', (key) => {
    const preventDefault = vi.fn();
    const activate = vi.fn();

    activateAgentControlFromKeyboard({ key, preventDefault }, activate);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(activate).toHaveBeenCalledOnce();
  });

  it('ignores unrelated and repeated keys', () => {
    const preventDefault = vi.fn();
    const activate = vi.fn();

    activateAgentControlFromKeyboard(
      { key: 'ArrowDown', preventDefault },
      activate
    );
    activateAgentControlFromKeyboard(
      { key: 'Enter', repeat: true, preventDefault },
      activate
    );

    expect(preventDefault).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });
});
