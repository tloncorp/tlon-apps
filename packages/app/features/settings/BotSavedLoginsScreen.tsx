import { getTlawnMoon } from '@tloncorp/api';
import {
  deleteBrowserLogin,
  listBrowserLogins,
  type SavedBrowserLogin,
} from '@tloncorp/api/client/browserVault';
import { Button, ConfirmDialog, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { View, YStack } from 'tamagui';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { ScreenHeader, SettingsContentScrollView } from '../../ui';
import { normalizeMoonName } from './bot/helpers';

export function BotSavedLoginsScreen({
  navigation,
}: {
  navigation: { goBack(): void };
}) {
  const planet = useCurrentUserId().replace(/^~/, '');
  const [moon, setMoon] = useState<string>();
  const [accounts, setAccounts] = useState<SavedBrowserLogin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [removing, setRemoving] = useState(false);
  const [selected, setSelected] = useState<SavedBrowserLogin>();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setAccounts([]);
    setMoon(undefined);
    setError(undefined);
    setSelected(undefined);
    void (async () => {
      try {
        const configuredMoon = await getTlawnMoon(planet);
        if (!configuredMoon) throw new Error('Bot unavailable.');
        const botMoon = normalizeMoonName(configuredMoon, planet);
        if (controller.signal.aborted) return;
        const records = await listBrowserLogins(botMoon, controller.signal);
        if (!controller.signal.aborted) {
          setMoon(botMoon);
          setAccounts(records);
        }
      } catch {
        if (!controller.signal.aborted)
          setError('Saved logins are unavailable. Try again.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [planet, revision]);

  const remove = useCallback(async () => {
    if (!moon || !selected || removing) return;
    setRemoving(true);
    setError(undefined);
    try {
      await deleteBrowserLogin(moon, {
        id: selected.id,
        revision: selected.revision,
      });
      setAccounts((records) =>
        records.filter((record) => record.id !== selected.id)
      );
      setSelected(undefined);
    } catch {
      setError('This login could not be deleted. Refresh and try again.');
    } finally {
      setRemoving(false);
    }
  }, [moon, selected, removing]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        title="Saved logins"
        backAction={() => navigation.goBack()}
      />
      <SettingsContentScrollView
        paddingHorizontal="$l"
        paddingTop="$l"
        safeAreaBottomOffset={24}
      >
        <YStack gap="$xl" maxWidth={560} width="100%" alignSelf="center">
          <Text color="$secondaryText">
            Your bot can use these logins on their saved websites. Deleting a
            login prevents future fills; it does not sign out an open browser.
          </Text>
          {loading ? (
            <Text>Loading saved logins…</Text>
          ) : !accounts.length && !error ? (
            <Text>No saved logins.</Text>
          ) : null}
          {accounts.map((account) => (
            <YStack
              key={account.id}
              gap="$m"
              padding="$l"
              backgroundColor="$background"
              borderRadius="$l"
            >
              <Text fontWeight="600">{account.label}</Text>
              <Text color="$secondaryText">{account.origin}</Text>
              {account.username ? <Text>{account.username}</Text> : null}
              <Button
                preset="secondary"
                label="Delete login"
                disabled={removing}
                onPress={() => setSelected(account)}
              />
            </YStack>
          ))}
          {error ? <Text color="$negativeActionText">{error}</Text> : null}
          <Button
            preset="secondary"
            label="Refresh"
            disabled={loading || removing}
            onPress={() => setRevision((value) => value + 1)}
          />
        </YStack>
      </SettingsContentScrollView>
      <ConfirmDialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !removing) setSelected(undefined);
        }}
        title="Delete saved login?"
        description={
          selected
            ? `Remove ${selected.label} from this bot's saved logins.`
            : ''
        }
        confirmText="Delete"
        onConfirm={() => void remove()}
      />
    </View>
  );
}
