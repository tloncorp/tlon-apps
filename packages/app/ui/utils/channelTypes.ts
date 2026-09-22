import type * as db from '@tloncorp/shared/db';
import type { IconType } from '@tloncorp/ui';

// What a kind of channel looks like and is called. Kept apart from the rest of
// the channel utilities, which reach for hooks, the store and the API client:
// these two are a pair of switches, and anything that only wants to name a
// channel type should not have to pull the app's whole data layer in behind
// them.

export function getChannelTypeIcon(type: db.Channel['type']): IconType {
  switch (type) {
    case 'dm':
      return 'Face';
    case 'groupDm':
      return 'Face';
    case 'chat':
      return 'ChannelTalk';
    case 'notebook':
      return 'Bulletin';
    case 'notes':
      return 'ChannelNotebooks';
    case 'gallery':
      return 'ChannelGalleries';
    default:
      return 'ChannelTalk';
  }
}

// Display names for channel types. %diary ('notebook') is the legacy longform
// type and reads as 'Bulletin'; %notes is the one you can still create, and it
// owns the 'Notebook' name.
export function getChannelTypeLabel(type: db.Channel['type']): string {
  switch (type) {
    case 'chat':
      return 'Chat';
    case 'notebook':
      return 'Bulletin';
    case 'notes':
      return 'Notebook';
    case 'gallery':
      return 'Gallery';
    default:
      return 'Channel';
  }
}
