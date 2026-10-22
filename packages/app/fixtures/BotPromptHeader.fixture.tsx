import { YStack } from 'tamagui';

import { BotPromptHeader } from '../ui/components/BotPromptHeader';
import { FixtureWrapper } from './FixtureWrapper';

function Specimen({ children }: { children: React.ReactNode }) {
  return (
    <FixtureWrapper fillWidth>
      <YStack padding="$2xl" gap="$3xl" maxWidth={520}>
        {children}
      </YStack>
    </FixtureWrapper>
  );
}

export default {
  Sheet: (
    <Specimen>
      <BotPromptHeader
        title="Identity"
        meta="IDENTITY.md"
        description="Added to Tlon's defaults and kept when Tlon updates them."
      />
      <BotPromptHeader
        title="Instructions"
        meta="~pinser-botter-bosser-hatber"
        description="How your Tlonbot behaves in every channel of My agent workspace."
      />
      <BotPromptHeader
        title="Instructions"
        meta="~pinser-botter-bosser-hatber"
        description="The bot id gives way before the title does."
        maxWidth={260}
      />
    </Specimen>
  ),
  Screen: (
    <Specimen>
      <BotPromptHeader
        meta="IDENTITY.md"
        description="How your bot identifies itself."
      />
      <BotPromptHeader
        meta="MEMORY.md"
        description="What your bot remembers between conversations. Read-only. Your bot keeps this file up to date as it learns."
      />
    </Specimen>
  ),
};
