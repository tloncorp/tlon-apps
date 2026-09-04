import {
  ReduceSurfaceInput,
  SurfacePostView,
  SurfaceReduction,
  SurfaceSpec,
  parseGroupChannelId,
  reduceSurface,
} from '@tloncorp/api';
import { desig, preSig } from '@tloncorp/api/lib/urbit';

import type * as db from '../../db';

/**
 * Wiring between the persisted post model and the shared surface reducer.
 *
 * The reducer compares author identity verbatim, so ship-string
 * canonicalization happens HERE and nowhere else — this boundary is part of
 * the security invariant. Both the channel host and every post author pass
 * through the same canonical form (leading `~`, lowercase, trimmed) before
 * the reducer sees them, so `$actor` keys and host checks cannot diverge on
 * sig or case differences between data sources.
 */
export function canonicalShipId(ship: string): string {
  return preSig(desig(ship).toLowerCase());
}

export function toSurfacePostView(post: db.Post): SurfacePostView {
  return {
    authorId:
      typeof post.authorId === 'string'
        ? canonicalShipId(post.authorId)
        : post.authorId,
    sequenceNum: post.sequenceNum,
    isEdited: post.isEdited,
    isDeleted: post.isDeleted,
    blob: post.blob,
    // the tie-break key for two posts sharing a sequence number (D174);
    // without it the fold depends on the order rows came back in
    id: post.id,
  };
}

/**
 * Reduces a surface channel's posts under its validated spec. `hostShip`
 * derives from the channel id — never from post or blob content.
 */
export function reduceSurfaceChannel({
  channelId,
  spec,
  posts,
  advertisedHead,
}: {
  channelId: string;
  spec: SurfaceSpec;
  posts: db.Post[];
  /**
   * The channel's server-advertised head. Supplied so a snapshot claiming
   * coverage beyond the posts that exist is refused rather than freezing
   * the board forever (D175).
   */
  advertisedHead?: number | null;
}): SurfaceReduction {
  const input: ReduceSurfaceInput = {
    spec,
    hostShip: canonicalShipId(parseGroupChannelId(channelId).host),
    posts: posts.map(toSurfacePostView),
    advertisedHead,
  };
  return reduceSurface(input);
}
