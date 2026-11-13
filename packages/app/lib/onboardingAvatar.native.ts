import { Skia } from '@shopify/react-native-skia';
import * as api from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Attachment } from '@tloncorp/shared/domain';
import { withRetry } from '@tloncorp/shared/logic';
import {
  updateCurrentUserProfile,
  uploadAsset,
  waitForUploads,
} from '@tloncorp/shared/store';
import { Directory, File, Paths } from 'expo-file-system';

import {
  type AvatarGlyphId,
  isAvatarGlyphId,
} from '../ui/components/Onboarding/line/avatarGlyphs';
import { glyphAvatarSvg } from '../ui/components/Onboarding/line/glyphAvatarSvg';

const logger = createDevLogger('onboardingAvatar', false);

const PIXELS = 512;
const RETRY = { startingDelay: 2000, numOfAttempts: 5, maxDelay: 15000 };

let running: Promise<void> | null = null;

/** Draws a glyph avatar to a PNG in the cache folder, with its size. */
function renderGlyphAvatar(glyph: AvatarGlyphId, who: 'you' | 'bot') {
  const svg = Skia.SVG.MakeFromString(glyphAvatarSvg(glyph, who, PIXELS));
  const surface = Skia.Surface.Make(PIXELS, PIXELS);
  if (!svg || !surface) {
    throw new Error('could not draw the avatar');
  }
  surface.getCanvas().drawSvg(svg, PIXELS, PIXELS);
  surface.flush();
  const directory = new Directory(Paths.cache, 'onboarding-avatar');
  directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, `${who}-${glyph}.png`);
  const bytes = surface.makeImageSnapshot().encodeToBytes();
  file.write(bytes);
  // The size comes from the bytes written: read back from the file right
  // after the write, it can still be 0, and storage refuses an empty upload.
  return { file, size: bytes.length };
}

async function uploadGlyphAvatar(glyph: AvatarGlyphId, who: 'you' | 'bot') {
  const { file, size } = renderGlyphAvatar(glyph, who);
  const intent: Attachment.UploadIntent = {
    type: 'fileUri',
    localUri: file.uri,
    name: file.name,
    size,
    mimeType: 'image/png',
  };
  const key = Attachment.UploadIntent.extractKey(intent);
  await uploadAsset(intent);
  const state = (await waitForUploads([key]))[key];
  if (state?.status !== 'success') {
    throw new Error('avatar upload did not finish');
  }
  return state.remoteUri;
}

async function saveNow() {
  const picked = await db.onboardingAvatar.getValue();
  if (!picked || picked.saved || !isAvatarGlyphId(picked.glyph)) return;
  const glyph = picked.glyph;

  const yours = await withRetry(() => uploadGlyphAvatar(glyph, 'you'), RETRY);
  await withRetry(
    () =>
      updateCurrentUserProfile({ avatarImage: yours }, { shouldThrow: true }),
    RETRY
  );

  await db.onboardingAvatar.setValue({ glyph, saved: true });
  logger.trackEvent('Onboarding avatar saved', { glyph });

  // The Tlonbot wears the same glyph, drawn the way onboarding shows it. Its
  // avatar is a nicety: a failure here leaves yours saved.
  const [botShip, botEnabled] = await Promise.all([
    db.hostedUserNodeId.getValue(),
    db.hostingBotEnabled.getValue().catch(() => false),
  ]);
  if (!botShip || !botEnabled) return;
  try {
    const botAvatar = await withRetry(
      () => uploadGlyphAvatar(glyph, 'bot'),
      RETRY
    );
    await withRetry(() => api.setTlawnAvatar(botShip, botAvatar), RETRY);
  } catch (error) {
    logger.trackError('Failed to save the Tlonbot onboarding avatar', {
      error,
    });
  }
}

/**
 * Saves the glyph picked on Profile as your avatar and your Tlonbot's. It
 * needs storage, so it runs once the app is connected to your computer. Safe
 * to call more than once: it does nothing after the first save.
 */
export function saveOnboardingAvatar() {
  running ??= saveNow()
    .catch((error) => {
      logger.trackError('Failed to save onboarding avatar', { error });
    })
    .finally(() => {
      running = null;
    });
  return running;
}
