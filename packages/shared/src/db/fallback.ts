import * as db from '../db';

export function getFallbackContact(id: string): db.Contact {
  return {
    id,
    nickname: null,
    avatarImage: null,
    coverImage: null,
    status: null,
    bio: null,
    color: null,
  };
}
