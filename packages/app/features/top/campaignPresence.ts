import { setConversationPresence } from '@tloncorp/api';
import { dr, render } from '@urbit/aura';

// Only the bot receives this entry. It is not a chat message or a typing status.
// Serialize keepalives and close so a slow open cannot resurrect a closed view.
export function publishCampaignView({
  conversationId,
  bot,
  token,
  timezone,
  reportError,
  publish = setConversationPresence,
}: {
  conversationId: string;
  bot: string;
  token: string;
  timezone: string;
  reportError: (error: unknown) => void;
  publish?: typeof setConversationPresence;
}) {
  let closed = false;
  let pending = Promise.resolve();
  const send = (open: boolean) => {
    pending = pending
      .then(async () => {
        if (open && closed) return;
        await publish({
          conversationId,
          topic: 'other',
          disclose: [bot],
          timeout: render('dr', dr.fromSeconds(90n)),
          display: {
            blob: JSON.stringify({
              type: 'tlon-onboarding-view',
              version: 1,
              token,
              timezone,
              open,
            }),
          },
        });
      })
      .catch(reportError);
  };
  send(true);
  const interval = setInterval(() => send(true), 30_000);
  return () => {
    closed = true;
    clearInterval(interval);
    send(false);
    return pending;
  };
}
