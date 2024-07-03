import type * as db from '@tloncorp/shared/dist/db';

export function isMuted(model: db.Group | db.Channel) {
  return model.volumeSettings?.isMuted ?? false;
}
