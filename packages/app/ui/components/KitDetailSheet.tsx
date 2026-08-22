import * as api from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  Button,
  Icon,
  IconType,
  Image,
  LoadingSpinner,
  Text,
  useCopy,
} from '@tloncorp/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

import { useRootNavigation } from '../../navigation/utils';
import { useCurrentUserId } from '../contexts/appDataContext';
import { triggerHaptic, useIsAdmin } from '../utils';
import { ActionSheet } from './ActionSheet';
import { Badge } from './Badge';
import { ContactName as ContactNameV2 } from './ContactNameV2';
import { TextInput } from './Form';
import { ListItem } from './ListItem';

const logger = createDevLogger('KitDetailSheet', true);

const INSTALL_STEPS = [
  'Creating group',
  'Setting up channels',
  'Waking the agent',
];
const INSTALL_TIMEOUT = 30 * 1000;
const KIT_NAME_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

const PLACE_ICONS: Record<api.KitPlace['kind'], IconType> = {
  chat: 'ChannelTalk',
  notebook: 'ChannelNotebooks',
  gallery: 'ChannelGalleries',
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The kit reference a detail sheet is opened with. Display fields are
 * optional; the sheet fills them in from the manifest once it loads. */
export interface KitDetailSheetKit {
  id: string;
  publisher: string;
  version?: string;
  name?: string;
  description?: string;
  image?: string | null;
}

type InstallFlow =
  | { phase: 'idle' }
  | { phase: 'naming' }
  | { phase: 'installing'; step: number; title: string }
  | { phase: 'error'; message: string; retry: () => void };

type KitActionButton = {
  title: string;
  accent?: 'hero' | 'heroPositive' | 'negative' | 'secondary' | 'minimal';
  onPress?: () => void;
  description?: string;
  disabled?: boolean;
  testID?: string;
};

interface KitDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit: KitDetailSheetKit;
  /** set when the sheet is opened from within a group whose blob carries a
   * kit (e.g. the group details "Kit" row) */
  contextGroup?: db.Group | null;
}

function KitDetailSheetComponent({
  open,
  onOpenChange,
  kit,
  contextGroup,
}: KitDetailSheetProps) {
  useEffect(() => {
    if (open) {
      triggerHaptic('sheetOpen');
    }
  }, [open]);

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      {open ? (
        <KitDetailPane
          kit={kit}
          contextGroup={contextGroup}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </ActionSheet>
  );
}

export const KitDetailSheet = React.memo(KitDetailSheetComponent);

export function KitDetailPane({
  kit,
  contextGroup,
  onClose,
}: {
  kit: KitDetailSheetKit;
  contextGroup?: db.Group | null;
  onClose: () => void;
}) {
  const { data: manifest, isLoading: isManifestLoading } = store.useKitManifest(
    kit.publisher,
    kit.id
  );
  const { data: installs } = store.useKitInstalls();
  const { data: localGroups } = store.useGroups({ includeUnjoined: true });
  const contextGroupKit = store.useGroupKit(contextGroup);
  const currentUserId = useCurrentUserId();
  const isContextAdmin = useIsAdmin(contextGroup?.id ?? '', currentUserId);
  const { navigateToGroup } = useRootNavigation();

  const [flow, setFlow] = useState<InstallFlow>({ phase: 'idle' });
  const [draftTitle, setDraftTitle] = useState('');
  const { doCopy: copyKitRef, didCopy: didCopyKitRef } = useCopy(
    api.kitRefPath(kit.publisher, kit.id)
  );

  const name = manifest?.name ?? kit.name ?? kit.id;
  const description = manifest?.description ?? kit.description ?? '';
  const image = manifest?.image ?? kit.image ?? null;
  const version = manifest?.version ?? kit.version;

  /** This kit's install ledger entries joined against local group state.
   * Installs whose group no longer exists locally (deleted groups) are
   * stale ledger entries and render nothing. */
  const runningIn = useMemo(() => {
    if (!installs) {
      return [];
    }
    return Object.entries(installs)
      .filter(
        ([, install]) =>
          install.id === kit.id && install.publisher === kit.publisher
      )
      .flatMap(([flag]) => {
        const group = localGroups?.find((g) => g.id === flag);
        return group ? [{ flag, group }] : [];
      });
  }, [installs, localGroups, kit.id, kit.publisher]);

  const isContextInstall =
    contextGroupKit != null &&
    contextGroupKit.kit.id === kit.id &&
    contextGroupKit.kit.publisher === kit.publisher;

  const closeAndNavigate = useCallback(
    (groupId: string) => {
      onClose();
      // let the sheet finish closing before navigating (see GroupPreviewSheet)
      setTimeout(() => navigateToGroup(groupId), 100);
    },
    [onClose, navigateToGroup]
  );

  const runInstall = useCallback(
    async (title: string) => {
      setFlow({ phase: 'installing', step: 0, title });
      try {
        const preexistingFlags = new Set(
          Object.keys(await api.getInstalls().catch(() => ({})))
        );
        await api.installKit({
          id: kit.id,
          name: kitGroupName(title, kit.id),
          meta: { title, description: '', image: '', cover: '' },
        });
        setFlow({ phase: 'installing', step: 1, title });

        // wait for the install ledger entry (group + channels created)
        const deadline = Date.now() + INSTALL_TIMEOUT;
        let flag: string | null = null;
        while (!flag && Date.now() < deadline) {
          await wait(1000);
          const current = await api.getInstalls().catch(() => null);
          if (current) {
            const found = Object.entries(current).find(
              ([installFlag, install]) =>
                !preexistingFlags.has(installFlag) &&
                install.id === kit.id &&
                install.publisher === kit.publisher
            );
            if (found) {
              flag = found[0];
            }
          }
        }
        if (!flag) {
          throw new Error('Timed out while creating the group.');
        }
        setFlow({ phase: 'installing', step: 2, title });

        // wait for the group row to sync locally so navigation lands on a
        // hydrated screen; if it doesn't arrive in budget, navigate anyway
        // and let sync catch up
        let group: db.Group | null = null;
        while (!group && Date.now() < deadline) {
          group = (await db.getGroup({ id: flag })) ?? null;
          if (!group) {
            await wait(1000);
          }
        }
        closeAndNavigate(flag);
      } catch (e) {
        logger.trackError('kit install failed', {
          kit: `${kit.publisher}/${kit.id}`,
          errorMessage: e?.message,
        });
        setFlow({
          phase: 'error',
          message: e?.message ?? 'Something went wrong.',
          retry: () => runInstall(title),
        });
      }
    },
    [kit.id, kit.publisher, closeAndNavigate]
  );

  const startInstall = useCallback(() => {
    setDraftTitle(name);
    setFlow({ phase: 'naming' });
  }, [name]);

  const removeKit = useCallback(() => {
    if (!contextGroup) {
      return;
    }
    const doRemove = async () => {
      try {
        await api.uninstallKit(contextGroup.id);
        onClose();
      } catch (e) {
        logger.trackError('kit uninstall failed', {
          kit: `${kit.publisher}/${kit.id}`,
          groupId: contextGroup.id,
          errorMessage: e?.message,
        });
        setFlow({
          phase: 'error',
          message: e?.message ?? 'Something went wrong.',
          retry: doRemove,
        });
      }
    };
    Alert.alert(
      'Remove kit?',
      `The group will remain, but ${name}'s automation will stop.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove kit', style: 'destructive', onPress: doRemove },
      ]
    );
  }, [contextGroup, kit.id, kit.publisher, name, onClose]);

  const actionButtons = useMemo(
    () =>
      getKitDetailActions(
        { isContextInstall, isContextAdmin },
        { startInstall, removeKit }
      ),
    [isContextInstall, isContextAdmin, startInstall, removeKit]
  );

  return (
    <ActionSheet.Content>
      <YStack paddingHorizontal="$xl" paddingVertical="$xl" gap="$xl">
        <YStack
          alignItems="center"
          padding="$xl"
          borderRadius="$xl"
          borderWidth={1}
          borderColor="$border"
          backgroundColor="$background"
          gap="$xl"
        >
          <KitHeroIcon image={image} />
          <Text size="$label/3xl" textAlign="center">
            {name}
          </Text>
          <Text size="$label/m" color="$tertiaryText">
            <ContactNameV2 contactId={kit.publisher} mode="contactId" />
          </Text>
          {version ? <Badge text={`v${version}`} type="neutral" /> : null}
        </YStack>

        {description ? (
          <YStack
            padding="$xl"
            borderRadius="$xl"
            borderWidth={1}
            borderColor="$border"
            backgroundColor="$background"
            gap="$xl"
          >
            <Text size="$label/m" color="$tertiaryText">
              Description
            </Text>
            <Text size="$body">{description}</Text>
          </YStack>
        ) : null}

        <YStack
          padding="$xl"
          borderRadius="$xl"
          borderWidth={1}
          borderColor="$border"
          backgroundColor="$background"
          gap="$l"
        >
          <Text size="$label/m" color="$tertiaryText">
            What it makes
          </Text>
          {manifest ? (
            manifest.places.length > 0 ? (
              manifest.places.map((place) => (
                <ListItem
                  key={place.name}
                  backgroundColor="unset"
                  paddingHorizontal={0}
                >
                  <ListItem.SystemIcon
                    icon={PLACE_ICONS[place.kind] ?? 'ChannelTalk'}
                  />
                  <ListItem.MainContent>
                    <ListItem.Title>{place.title}</ListItem.Title>
                    {place.description ? (
                      <ListItem.Subtitle>{place.description}</ListItem.Subtitle>
                    ) : null}
                  </ListItem.MainContent>
                </ListItem>
              ))
            ) : (
              <Text size="$body" color="$secondaryText">
                This kit doesn&rsquo;t create any channels.
              </Text>
            )
          ) : isManifestLoading ? (
            <XStack justifyContent="center" padding="$l">
              <LoadingSpinner size="small" />
            </XStack>
          ) : (
            <Text size="$body" color="$secondaryText">
              Couldn&rsquo;t load the kit&rsquo;s details from{' '}
              <ContactNameV2 contactId={kit.publisher} mode="contactId" />.
            </Text>
          )}
        </YStack>

        {manifest && manifest.schedules.length > 0 ? (
          <YStack
            padding="$xl"
            borderRadius="$xl"
            borderWidth={1}
            borderColor="$border"
            backgroundColor="$background"
            gap="$l"
          >
            <Text size="$label/m" color="$tertiaryText">
              What it does
            </Text>
            {manifest.schedules.map((schedule) => (
              <Text key={schedule.id} size="$body">
                {schedule.description}
              </Text>
            ))}
          </YStack>
        ) : null}

        {runningIn.length > 0 ? (
          <YStack
            padding="$xl"
            borderRadius="$xl"
            borderWidth={1}
            borderColor="$border"
            backgroundColor="$background"
            gap="$l"
          >
            <Text size="$label/m" color="$tertiaryText">
              Running in
            </Text>
            {runningIn.map(({ flag, group }) => (
              <ListItem
                key={flag}
                backgroundColor="unset"
                paddingHorizontal={0}
                onPress={() => closeAndNavigate(flag)}
                testID={`KitRunningInRow-${flag}`}
              >
                <ListItem.GroupIcon model={group} />
                <ListItem.MainContent>
                  <ListItem.Title>{group.title || flag}</ListItem.Title>
                </ListItem.MainContent>
                <ListItem.EndContent justifyContent="center">
                  <ListItem.SystemIcon
                    icon="ChevronRight"
                    backgroundColor="unset"
                  />
                </ListItem.EndContent>
              </ListItem>
            ))}
          </YStack>
        ) : null}

        <Text size="$label/m" color="$tertiaryText" textAlign="center">
          Published by{' '}
          <ContactNameV2 contactId={kit.publisher} mode="contactId" />
          {version ? ` · v${version}` : ''}
        </Text>

        {flow.phase === 'idle' ? (
          <YStack gap="$m">
            {actionButtons.map((action) => (
              <YStack key={action.title} gap="$xs">
                <Button
                  {...buttonPropsForAccent(action.accent)}
                  disabled={action.disabled}
                  onPress={action.onPress}
                  testID={action.testID ?? `ActionButton-${action.title}`}
                  alignSelf="stretch"
                  label={action.title}
                  centered
                />
                {action.description ? (
                  <Text
                    size="$label/m"
                    color="$tertiaryText"
                    textAlign="center"
                  >
                    {action.description}
                  </Text>
                ) : null}
              </YStack>
            ))}
            <Button
              fill="outline"
              type="secondary"
              onPress={copyKitRef}
              leadingIcon={didCopyKitRef ? 'Checkmark' : 'Copy'}
              testID="ActionButton-CopyKit"
              alignSelf="stretch"
              label="Copy kit"
              centered
            />
          </YStack>
        ) : flow.phase === 'naming' ? (
          <YStack gap="$l">
            <Text size="$label/m" color="$tertiaryText">
              Name your group
            </Text>
            <TextInput
              placeholder="Group name"
              value={draftTitle}
              onChangeText={setDraftTitle}
              onSubmitEditing={() =>
                draftTitle.trim() && runInstall(draftTitle.trim())
              }
              returnKeyType="go"
              testID="KitGroupNameInput"
            />
            <Button
              fill="solid"
              type="primary"
              disabled={!draftTitle.trim()}
              onPress={() => runInstall(draftTitle.trim())}
              testID="ActionButton-CreateKitGroup"
              alignSelf="stretch"
              label="Create group"
              centered
            />
            <Button
              fill="text"
              type="primary"
              onPress={() => setFlow({ phase: 'idle' })}
              testID="ActionButton-CancelKitInstall"
              alignSelf="stretch"
              label="Cancel"
              centered
            />
          </YStack>
        ) : flow.phase === 'installing' ? (
          <InstallProgress step={flow.step} />
        ) : (
          <YStack gap="$m">
            <Text
              size="$label/m"
              color="$negativeActionText"
              textAlign="center"
            >
              {flow.message}
            </Text>
            <Button
              fill="solid"
              type="primary"
              onPress={flow.retry}
              testID="ActionButton-RetryKitAction"
              alignSelf="stretch"
              label="Retry"
              centered
            />
            <Button
              fill="text"
              type="primary"
              onPress={() => setFlow({ phase: 'idle' })}
              testID="ActionButton-DismissKitError"
              alignSelf="stretch"
              label="Cancel"
              centered
            />
          </YStack>
        )}
      </YStack>
    </ActionSheet.Content>
  );
}

/**
 * Pure mapping from viewer state to the sheet's CTA stack. Kits are
 * templates — users can install as many instances as they want — so the
 * primary CTA is always "Get this kit"; existing instances are surfaced
 * in the "Running in" section instead of hijacking the CTA.
 */
export function getKitDetailActions(
  status: {
    isContextInstall: boolean;
    isContextAdmin: boolean;
  },
  actions: {
    startInstall: () => void;
    removeKit: () => void;
  }
): KitActionButton[] {
  const buttons: KitActionButton[] = [
    {
      title: 'Get this kit',
      accent: 'hero',
      onPress: actions.startInstall,
      testID: 'ActionButton-GetKit',
    },
  ];
  if (status.isContextInstall && status.isContextAdmin) {
    buttons.push({
      title: 'Remove kit',
      accent: 'negative',
      onPress: actions.removeKit,
      description: 'The group stays — the kit’s automation stops.',
      testID: 'ActionButton-RemoveKit',
    });
  }
  return buttons;
}

// Map v1 accent to v2 fill/type (same mapping as GroupPreviewSheet)
function buttonPropsForAccent(accent: KitActionButton['accent']) {
  switch (accent) {
    case 'hero':
      return { fill: 'solid' as const, type: 'primary' as const };
    case 'heroPositive':
      return { fill: 'solid' as const, type: 'positive' as const };
    case 'negative':
      return { fill: 'outline' as const, type: 'negative' as const };
    case 'secondary':
      return { fill: 'outline' as const, type: 'secondary' as const };
    case 'minimal':
      return { fill: 'text' as const, type: 'primary' as const };
    default:
      return { fill: 'outline' as const, type: 'primary' as const };
  }
}

function InstallProgress({ step }: { step: number }) {
  return (
    <YStack width="100%">
      {INSTALL_STEPS.map((description, index) => (
        <ListItem backgroundColor="unset" key={index}>
          <ListItem.MainContent>
            <ListItem.Title color={index > step ? '$tertiaryText' : undefined}>
              {description}
            </ListItem.Title>
          </ListItem.MainContent>
          <ListItem.EndContent width="$3xl" alignItems="center">
            {index === step && <LoadingSpinner size="small" />}
            {index < step && <ListItem.SystemIcon icon="Checkmark" />}
          </ListItem.EndContent>
        </ListItem>
      ))}
    </YStack>
  );
}

function KitHeroIcon({ image }: { image: string | null }) {
  if (image) {
    return (
      <Image
        source={image}
        width="$9xl"
        height="$9xl"
        borderRadius="$xl"
        contentFit="cover"
      />
    );
  }
  return (
    <View
      width="$9xl"
      height="$9xl"
      borderRadius="$xl"
      backgroundColor="$secondaryBackground"
      alignItems="center"
      justifyContent="center"
    >
      <Icon type="Gift" color="$secondaryText" />
    </View>
  );
}

/** Derive a valid @tas group name from a chosen title: kebab-cased title
 * stem (falling back to the kit id) plus 4 random lowercase alphanumerics. */
export function kitGroupName(title: string, kitId: string): string {
  const base = title
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const stem = (/^[a-z]/.test(base) ? base.slice(0, 40) : kitId).replace(
    /-+$/,
    ''
  );
  const suffix = Array.from(
    { length: 4 },
    () =>
      KIT_NAME_ALPHABET[Math.floor(Math.random() * KIT_NAME_ALPHABET.length)]
  ).join('');
  return `${stem}-${suffix}`;
}
