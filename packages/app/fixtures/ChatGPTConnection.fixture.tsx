import type { TlawnLLMAuthFlow } from '@tloncorp/api';
import { Text } from '@tloncorp/ui';
import React, { useState } from 'react';

import type { OpenAIAuthState } from '../features/settings/bot/openAiSubscription';
import { openOAuthUrl } from '../features/settings/openOAuthUrl';
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
  nativeBrowserDemo = false,
}: {
  initialState: OpenAIAuthState;
  nativeBrowserDemo?: boolean;
}) {
  const [state, setState] = useState(initialState);
  const [browserError, setBrowserError] = useState<string | null>(null);
  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      {nativeBrowserDemo ? (
        <Text
          size="$label/s"
          color="$secondaryText"
          textAlign="center"
          padding="$m"
        >
          Preview · connection result is simulated
        </Text>
      ) : null}
      <LLMSubscriptionAuthView
        state={state}
        browserError={browserError}
        onStart={() => setState({ phase: 'active', flow })}
        onOpenBrowser={async () => {
          setBrowserError(null);
          if (nativeBrowserDemo) {
            try {
              await openOAuthUrl('https://auth.openai.com/codex/device', null);
            } catch {
              setBrowserError(
                'Could not open the sign-in preview. Please try again.'
              );
              return;
            }
          }
          setState({
            phase: 'connected',
            flow: { ...flow, status: 'complete' },
          });
        }}
        onContinue={() => setState({ phase: 'active', flow })}
        onSubmitToken={async () => false}
        onRetry={() => setState({ phase: 'active', flow })}
        onCancel={() => setState({ phase: 'active', flow })}
      />
    </FixtureWrapper>
  );
}

export default {
  'Native browser demo': (
    <ChatGPTConnection
      nativeBrowserDemo
      initialState={{ phase: 'active', flow }}
    />
  ),
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
