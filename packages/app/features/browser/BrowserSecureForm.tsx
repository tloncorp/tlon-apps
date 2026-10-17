import { Button, Icon, Text } from '@tloncorp/ui';
import { XStack, YStack, isWeb } from 'tamagui';

import {
  type BrowserCredentialHandoff,
  validBrowserFormValues,
} from './browserCredentialHandoff';
import { BrowserSecureFields } from './BrowserSecureFields';

export function BrowserSecureForm({
  handoff,
  values,
  submitting,
  error,
  onChange,
  onSubmit,
}: {
  handoff: BrowserCredentialHandoff;
  values: Record<string, string>;
  submitting: boolean;
  error?: string;
  onChange(id: string, value: string): void;
  onSubmit(): void;
}) {
  return (
    <YStack gap="$2xl">
      <YStack gap="$xl">
        <XStack alignItems="center" gap="$l">
          <Icon type="Lock" size="$xl" color="$primaryText" />
          <YStack flex={1} minWidth={0} gap="$m">
            <Text size="$label/m" color="$secondaryText">
              {handoff.kind === 'login' ? 'Sign in to' : 'Enter details for'}
            </Text>
            <Text size="$label/3xl" fontWeight="600">
              {new URL(handoff.origin).hostname}
            </Text>
          </YStack>
        </XStack>
        <Text size="$label/l" color="$secondaryText">
          Your details go directly to the live browser. They are never posted to
          chat or returned to the bot.
        </Text>
        {handoff.kind === 'details' ? (
          <Text size="$label/l" color="$secondaryText">
            Filling these fields does not submit a payment or place an order.
          </Text>
        ) : null}
      </YStack>
      <BrowserSecureFields
        fields={handoff.fields}
        formId={handoff.formId}
        values={values}
        disabled={submitting}
        showSections={handoff.kind === 'details'}
        onChange={onChange}
        onSubmit={onSubmit}
      />
      {error ? (
        <Text color="$negativeActionText" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button
        role="button"
        tabIndex={
          submitting || !validBrowserFormValues(handoff, values) ? -1 : 0
        }
        onKeyDown={
          isWeb
            ? (event) => {
                if (
                  !submitting &&
                  validBrowserFormValues(handoff, values) &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault();
                  onSubmit();
                }
              }
            : undefined
        }
        accessibilityRole="button"
        focusable
        preset="primary"
        size="large"
        label={handoff.kind === 'login' ? 'Continue' : 'Fill fields'}
        centered
        loading={submitting}
        disabled={submitting || !validBrowserFormValues(handoff, values)}
        onPress={onSubmit}
      />
    </YStack>
  );
}
