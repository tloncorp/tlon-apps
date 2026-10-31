import { describe, expect, it, vi } from 'vitest';

import {
  emptyBudgetHoldState,
  type BudgetState,
  type CreditSignal,
} from './cron-budget-hold.js';
import {
  billingFailureKeyOwner,
  isApiKeyBillingReply,
  reconcileCreditNotice,
} from './credit-notice.js';

const tlon = (remainingUsd: number, limitUsd = 5): CreditSignal => ({
  keyOwner: 'tlon',
  remainingUsd,
  limitUsd,
});
const own = (remainingUsd: number | null, limitUsd: number | null) =>
  ({ keyOwner: 'owner', remainingUsd, limitUsd }) as CreditSignal;

const LOW_INCLUDED =
  "You've used over 80% of this month's included credits. When they're nearly gone, I'll switch to a free model until they reset.";
const LIMITED =
  "You've used almost all of this month's included credits, so I've switched to a free model until they reset.";

function fixture() {
  const state = emptyBudgetHoldState();
  const notify = vi.fn(
    async (_message: string, _offerIncrease: boolean) => true
  );
  // The hold pass owns `limited`; mirror it here.
  const reconcile = (budget: BudgetState, credit: CreditSignal | null) => {
    if (budget === 'limited') state.limited = true;
    if (budget === 'available') state.limited = false;
    return reconcileCreditNotice({
      budget,
      credit,
      state,
      save: async () => {},
      notify,
    });
  };
  return { state, notify, reconcile };
}

describe('credit notice', () => {
  it('warns once as included credit runs low, and again in the next month', async () => {
    const f = fixture();
    await f.reconcile('available', tlon(1.5));
    expect(f.notify).not.toHaveBeenCalled();
    await f.reconcile('available', tlon(0.9));
    await f.reconcile('available', tlon(0.6));
    expect(f.notify).toHaveBeenCalledExactlyOnceWith(LOW_INCLUDED, true);
    await f.reconcile('available', tlon(5));
    await f.reconcile('available', tlon(0.9));
    expect(f.notify).toHaveBeenCalledTimes(2);
  });

  it("names the owner's own key and offers no credit increase for it", async () => {
    const f = fixture();
    await f.reconcile('available', own(3, 20));
    expect(f.notify).toHaveBeenCalledExactlyOnceWith(
      "Your OpenRouter key has $3.00 of its $20.00 limit left. When it runs out, I can't reply until you add credits or raise its limit on OpenRouter.",
      false
    );
  });

  it('has nothing to say about a key without a limit', async () => {
    const f = fixture();
    await f.reconcile('unknown', own(null, null));
    await f.reconcile('available', own(null, null));
    expect(f.notify).not.toHaveBeenCalled();
  });

  it('tells the owner again when hosting limits the bot, but not when a credit increase eases it', async () => {
    const f = fixture();
    await f.reconcile('available', tlon(0.9));
    await f.reconcile('limited', tlon(0.2));
    expect(f.notify).toHaveBeenLastCalledWith(LIMITED, true);
    // An increase to $10 leaves 7% left: low, but nothing new.
    await f.reconcile('available', tlon(0.7, 10));
    expect(f.notify).toHaveBeenCalledTimes(2);
    await f.reconcile('limited', tlon(0.2, 10));
    expect(f.notify).toHaveBeenCalledTimes(3);
  });

  it('keeps its place while the key cannot be read', async () => {
    const f = fixture();
    f.notify.mockResolvedValueOnce(false);
    await f.reconcile('available', tlon(0.9));
    await f.reconcile('unknown', null);
    expect(f.state.noticeLevel).toBe('low');
    expect(f.state.notificationAttempts).toBe(1);
    expect(f.notify).toHaveBeenCalledTimes(1);
  });

  it('does not repeat a limited notice an older plugin already sent', async () => {
    const f = fixture();
    Object.assign(f.state, { limited: true, notified: true, episodeId: 'e' });
    await f.reconcile('limited', tlon(0.2));
    expect(f.notify).not.toHaveBeenCalled();
    expect(f.state.noticeId).toBe('e');
  });
});

describe('billing failures', () => {
  it.each([
    "⚠️ API provider returned a billing error — your API key has run out of credits or has an insufficient balance. Check your provider's billing dashboard and top up or switch to a different API key.",
    '⚠️ openrouter (openai/gpt-5.6-luna) returned a billing error — your API key has run out of credits or has an insufficient balance. Check your openrouter billing dashboard and top up or switch to a different API key.',
  ])('recognizes core API-key billing reply %#', (text) => {
    expect(isApiKeyBillingReply(text)).toBe(true);
  });

  it('leaves subscription billing replies and other errors alone', () => {
    expect(
      isApiKeyBillingReply(
        '⚠️ API provider returned a billing error — check your account for subscription or usage limits, then try again.'
      )
    ).toBe(false);
    expect(isApiKeyBillingReply('LLM request failed.')).toBe(false);
  });

  it.each<[BudgetState, CreditSignal | null, CreditSignal['keyOwner'] | null]>([
    ['unknown', own(null, null), 'owner'],
    ['available', own(15, 20), 'owner'],
    ['limited', tlon(0.2), 'tlon'],
    ['available', tlon(0.1), 'tlon'],
    // Tlon's own account refused the request, not the owner's credit.
    ['available', tlon(2.5), null],
    ['available', null, null],
  ])('with %s credit %o, blames %s', (state, credit, keyOwner) => {
    expect(billingFailureKeyOwner({ state, credit })).toBe(keyOwner);
  });
});
