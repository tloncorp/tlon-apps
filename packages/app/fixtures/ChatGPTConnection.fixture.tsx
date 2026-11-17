import type { TlawnLLMAuthFlow } from '@tloncorp/api';
import React, { useState } from 'react';

import type { OpenAIAuthState } from '../features/settings/bot/openAiSubscription';
import { LLMSubscriptionAuthView } from '../ui/components/LLMSubscriptionAuthView';
import { FixtureWrapper } from './FixtureWrapper';

const flow: TlawnLLMAuthFlow = {
  id: 'fixture-chatgpt',
  provider: 'openai',
  status: 'awaiting_browser',
  expiresAt: Date.now() + 900_000,
  userCode: 'ABCD-1234',
  verificationUrl: 'https://auth.openai.com/codex/device',
};

function ChatGPTConnection({
  initialState,
}: {
  initialState: OpenAIAuthState;
}) {
  const [state, setState] = useState(initialState);
  return (
    <FixtureWrapper fillWidth fillHeight>
      <LLMSubscriptionAuthView
        state={state}
        onStart={() => setState({ phase: 'active', flow })}
        onOpenBrowser={async () =>
          setState({
            phase: 'connected',
            flow: { ...flow, status: 'complete' },
          })
        }
        onContinue={() => setState({ phase: 'active', flow })}
        onSubmitToken={async () => false}
        onRetry={() => setState({ phase: 'active', flow })}
        onCancel={() => setState({ phase: 'active', flow })}
      />
    </FixtureWrapper>
  );
}

export default {
  'Copy and continue': (
    <ChatGPTConnection initialState={{ phase: 'active', flow }} />
  ),
  Connected: (
    <ChatGPTConnection
      initialState={{
        phase: 'connected',
        flow: { ...flow, status: 'complete' },
      }}
    />
  ),
  Expired: (
    <ChatGPTConnection
      initialState={{
        phase: 'error',
        message: 'This connection attempt expired.',
        restartable: true,
        flow,
      }}
    />
  ),
};
