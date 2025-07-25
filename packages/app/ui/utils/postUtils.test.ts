import * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import { computeReactionDetails } from './postUtils';

describe('computeReactionDetails', () => {
  describe('contact name resolution', () => {
    test('should use custom nickname when available', () => {
      const reactions: db.Reaction[] = [
        {
          postId: 'post-1',
          contactId: '~zod',
          value: '👍',
          contact: {
            id: '~zod',
            customNickname: 'Custom Name',
            peerNickname: 'Peer Name',
          } as db.Contact,
        },
      ];

      const result = computeReactionDetails(reactions, '~sampel-palnet');

      expect(result.list[0].users[0].name).toBe('Custom Name');
    });

    test('should fall back to peer nickname when custom nickname is empty', () => {
      const reactions: db.Reaction[] = [
        {
          postId: 'post-1',
          contactId: '~zod',
          value: '👍',
          contact: {
            id: '~zod',
            customNickname: '',
            peerNickname: 'Peer Name',
          } as db.Contact,
        },
      ];

      const result = computeReactionDetails(reactions, '~sampel-palnet');

      expect(result.list[0].users[0].name).toBe('Peer Name');
    });

    test('should fall back to peer nickname when custom nickname is null', () => {
      const reactions: db.Reaction[] = [
        {
          postId: 'post-1',
          contactId: '~zod',
          value: '👍',
          contact: {
            id: '~zod',
            customNickname: null,
            peerNickname: 'Peer Name',
          } as db.Contact,
        },
      ];

      const result = computeReactionDetails(reactions, '~sampel-palnet');

      expect(result.list[0].users[0].name).toBe('Peer Name');
    });

    test('should fall back to contact ID when both nicknames are empty', () => {
      const reactions: db.Reaction[] = [
        {
          postId: 'post-1',
          contactId: '~zod',
          value: '👍',
          contact: {
            id: '~zod',
            customNickname: '',
            peerNickname: '',
          } as db.Contact,
        },
      ];

      const result = computeReactionDetails(reactions, '~sampel-palnet');

      expect(result.list[0].users[0].name).toBe('~zod');
    });

    test('should handle whitespace-only nicknames by trimming and falling back', () => {
      const reactions: db.Reaction[] = [
        {
          postId: 'post-1',
          contactId: '~zod',
          value: '👍',
          contact: {
            id: '~zod',
            customNickname: '   ',
            peerNickname: ' Valid Name ',
          } as db.Contact,
        },
      ];

      const result = computeReactionDetails(reactions, '~sampel-palnet');

      expect(result.list[0].users[0].name).toBe('Valid Name');
    });

    test('should fall back to contact ID when both nicknames are null', () => {
      const reactions: db.Reaction[] = [
        {
          postId: 'post-1',
          contactId: '~zod',
          value: '👍',
          contact: {
            id: '~zod',
            customNickname: null,
            peerNickname: null,
          } as db.Contact,
        },
      ];

      const result = computeReactionDetails(reactions, '~sampel-palnet');

      expect(result.list[0].users[0].name).toBe('~zod');
    });

    test('should fall back to contact ID when contact is null', () => {
      const reactions: db.Reaction[] = [
        {
          postId: 'post-1',
          contactId: '~zod',
          value: '👍',
          contact: null,
        },
      ];

      const result = computeReactionDetails(reactions, '~sampel-palnet');

      expect(result.list[0].users[0].name).toBe('~zod');
    });

    test('should fall back to contact ID when contact is undefined', () => {
      const reactions: db.Reaction[] = [
        {
          postId: 'post-1',
          contactId: '~zod',
          value: '👍',
          contact: undefined,
        },
      ];

      const result = computeReactionDetails(reactions, '~sampel-palnet');

      expect(result.list[0].users[0].name).toBe('~zod');
    });

    test('should fall back to "Unknown User" when contactId is also empty', () => {
      const reactions: db.Reaction[] = [
        {
          postId: 'post-1',
          contactId: '',
          value: '👍',
          contact: {
            id: '',
            customNickname: '',
            peerNickname: '',
          } as db.Contact,
        },
      ];

      const result = computeReactionDetails(reactions, '~sampel-palnet');

      expect(result.list[0].users[0].name).toBe('Unknown User');
    });

    test('should handle multiple users with different name resolution scenarios', () => {
      const reactions: db.Reaction[] = [
        {
          postId: 'post-1',
          contactId: '~zod',
          value: '👍',
          contact: {
            id: '~zod',
            customNickname: 'Custom Name',
            peerNickname: 'Peer Name',
          } as db.Contact,
        },
        {
          postId: 'post-1',
          contactId: '~bus',
          value: '👍',
          contact: {
            id: '~bus',
            customNickname: '',
            peerNickname: 'Bus Peer Name',
          } as db.Contact,
        },
        {
          postId: 'post-1',
          contactId: '~web',
          value: '👍',
          contact: {
            id: '~web',
            customNickname: '',
            peerNickname: '',
          } as db.Contact,
        },
      ];

      const result = computeReactionDetails(reactions, '~sampel-palnet');

      const users = result.list[0].users;
      expect(users[0].name).toBe('Custom Name');
      expect(users[1].name).toBe('Bus Peer Name');
      expect(users[2].name).toBe('~web');
    });

    test('should be consistent between first reaction and additional reactions', () => {
      const reactions: db.Reaction[] = [
        {
          postId: 'post-1',
          contactId: '~zod',
          value: '👍',
          contact: {
            id: '~zod',
            customNickname: '',
            peerNickname: 'Peer Name',
          } as db.Contact,
        },
        {
          postId: 'post-1',
          contactId: '~bus',
          value: '👍',
          contact: {
            id: '~bus',
            customNickname: '',
            peerNickname: 'Bus Peer Name',
          } as db.Contact,
        },
      ];

      const result = computeReactionDetails(reactions, '~sampel-palnet');

      const users = result.list[0].users;
      expect(users[0].name).toBe('Peer Name');
      expect(users[1].name).toBe('Bus Peer Name');
    });
  });

  describe('reaction aggregation', () => {
    test('should aggregate reactions by value', () => {
      const reactions: db.Reaction[] = [
        {
          postId: 'post-1',
          contactId: '~zod',
          value: '👍',
          contact: {
            id: '~zod',
            customNickname: 'Zod',
            peerNickname: null,
          } as db.Contact,
        },
        {
          postId: 'post-1',
          contactId: '~bus',
          value: '👍',
          contact: {
            id: '~bus',
            customNickname: 'Bus',
            peerNickname: null,
          } as db.Contact,
        },
        {
          postId: 'post-1',
          contactId: '~web',
          value: '❤️',
          contact: {
            id: '~web',
            customNickname: 'Web',
            peerNickname: null,
          } as db.Contact,
        },
      ];

      const result = computeReactionDetails(reactions, '~sampel-palnet');

      expect(result.list).toHaveLength(2);
      expect(result.list[0].value).toBe('👍');
      expect(result.list[0].count).toBe(2);
      expect(result.list[1].value).toBe('❤️');
      expect(result.list[1].count).toBe(1);
    });

    test('should track self reactions', () => {
      const reactions: db.Reaction[] = [
        {
          postId: 'post-1',
          contactId: '~zod',
          value: '👍',
          contact: {
            id: '~zod',
            customNickname: 'Zod',
            peerNickname: null,
          } as db.Contact,
        },
      ];

      const result = computeReactionDetails(reactions, '~zod');

      expect(result.self.didReact).toBe(true);
      expect(result.self.value).toBe('👍');
    });

    test('should not mark as self reaction when user is not the reactor', () => {
      const reactions: db.Reaction[] = [
        {
          postId: 'post-1',
          contactId: '~zod',
          value: '👍',
          contact: {
            id: '~zod',
            customNickname: 'Zod',
            peerNickname: null,
          } as db.Contact,
        },
      ];

      const result = computeReactionDetails(reactions, '~sampel-palnet');

      expect(result.self.didReact).toBe(false);
      expect(result.self.value).toBe('');
    });
  });
});
