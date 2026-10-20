import { describe, expect, it } from 'bun:test';
import { da } from '@urbit/aura';

import {
  channelCreatedLines,
  dmWritTime,
  formatPostId,
  getOption,
  getRequiredOptionValue,
  hasOptionValue,
  isCommandHelpRequest,
  isDiaryNest,
  isGroupFlag,
  isSubcommandHelpRequest,
  looksLikePositionalChannelKind,
  looksLikeRemovedPositionalChannelKind,
  undottedPostId,
  wantsHelp,
} from './cli-utils';

describe('cli-utils', () => {
  describe('isGroupFlag', () => {
    it('accepts ~host/slug with a valid ship', () => {
      expect(isGroupFlag('~zod/book-club')).toBe(true);
      expect(isGroupFlag('~sampel-palnet/g2')).toBe(true);
    });

    it('rejects invalid ships, empty slugs and uppercase slugs', () => {
      expect(isGroupFlag('~foo/x')).toBe(false);
      expect(isGroupFlag('~zod/')).toBe(false);
      expect(isGroupFlag('~zod/Bad')).toBe(false);
      expect(isGroupFlag('zod/book-club')).toBe(false);
    });
  });

  describe('channelCreatedLines', () => {
    it('prints the nest and the group Ref, since channels have no card', () => {
      expect(
        channelCreatedLines('chat/~zod/abc', 'Discussion', '~zod/proj')
      ).toEqual([
        '   Nest: chat/~zod/abc',
        '   Title: Discussion',
        '   Group: ~zod/proj',
        '   Ref: /1/group/~zod/proj',
        '   Share: channels have no card yet; name the channel and its Nest, and include the group Ref path in a chat message to post a tappable group card.',
      ]);
    });
  });

  describe('wantsHelp', () => {
    it('detects long help flag', () => {
      expect(wantsHelp(['add-channel', '--help'])).toBe(true);
    });

    it('detects short help flag', () => {
      expect(wantsHelp(['update', '-h'])).toBe(true);
    });

    it('returns false when help is absent', () => {
      expect(wantsHelp(['groups', 'info', '~zod/test'])).toBe(false);
    });
  });

  describe('looksLikePositionalChannelKind', () => {
    it('detects channel kind passed positionally', () => {
      const args = ['add-channel', '~zod/test', 'chat', 'Projects'];
      expect(looksLikePositionalChannelKind(args, 2)).toBe(true);
    });

    it('does not flag valid --kind usage', () => {
      const args = ['add-channel', '~zod/test', 'Projects', '--kind', 'chat'];
      expect(looksLikePositionalChannelKind(args, 2)).toBe(false);
      expect(getOption(args, 'kind')).toBe('chat');
    });

    it('preserves empty option values', () => {
      expect(getOption(['update', '--description', ''], 'description')).toBe(
        ''
      );
    });

    it('can ignore positional values before options', () => {
      const args = ['create-owned', '--owner', '--owner', '~zod'];

      expect(getOption(args, 'owner', 2)).toBe('~zod');
    });

    it('does not flag ordinary titles', () => {
      const args = ['add-channel', '~zod/test', 'Projects'];
      expect(looksLikePositionalChannelKind(args, 2)).toBe(false);
    });

    it('no longer treats diary as a live positional channel kind', () => {
      const args = ['add-channel', '~zod/test', 'diary', 'Projects'];
      expect(looksLikePositionalChannelKind(args, 2)).toBe(false);
    });
  });

  describe('removed diary channel kind', () => {
    it('detects diary passed positionally where a kind would go', () => {
      const args = ['create', '~zod/test', 'diary', 'Projects'];
      expect(looksLikeRemovedPositionalChannelKind(args, 2)).toBe(true);
    });

    it('does not flag diary when it is the only positional (a title)', () => {
      const args = ['create', '~zod/test', 'diary'];
      expect(looksLikeRemovedPositionalChannelKind(args, 2)).toBe(false);
    });

    it('does not flag diary passed as an explicit --kind value here', () => {
      const args = ['create', '~zod/test', 'Notes', '--kind', 'diary'];
      expect(looksLikeRemovedPositionalChannelKind(args, 2)).toBe(false);
    });
  });

  describe('isDiaryNest', () => {
    it('matches a diary nest', () => {
      expect(isDiaryNest('diary/~host/blog')).toBe(true);
    });

    it('does not match chat or heap nests', () => {
      expect(isDiaryNest('chat/~host/general')).toBe(false);
      expect(isDiaryNest('heap/~host/gallery')).toBe(false);
    });

    it('is safe for an undefined nest', () => {
      expect(isDiaryNest(undefined)).toBe(false);
    });
  });

  describe('getRequiredOptionValue', () => {
    it('returns the following option value', () => {
      expect(getRequiredOptionValue(['--content', 'story.json'], 0)).toBe(
        'story.json'
      );
    });

    it('fails when the option value is missing', () => {
      expect(() => getRequiredOptionValue(['--content'], 0)).toThrow(
        '--content requires a value'
      );
    });

    it('fails when the next token is another option', () => {
      expect(() =>
        getRequiredOptionValue(['--content', '--markdown', 'post.md'], 0)
      ).toThrow('--content requires a value');
    });
  });

  describe('hasOptionValue', () => {
    it('allows values that start with dashes when they are not known options', () => {
      const args = ['update-profile', '--bio', '--starts-with-dashes'];

      expect(hasOptionValue(args, 'bio', ['nickname', 'bio'])).toBe(true);
    });

    it('treats a following known option as a missing value', () => {
      const args = ['update-profile', '--bio', '--nickname', 'Pat'];

      expect(hasOptionValue(args, 'bio', ['nickname', 'bio'])).toBe(false);
    });

    it('treats an empty string as an explicit option value', () => {
      const args = ['update-profile', '--status', ''];

      expect(hasOptionValue(args, 'status', ['status'])).toBe(true);
    });
  });

  describe('explicit help slots', () => {
    it('detects family subcommand help only in the second slot', () => {
      expect(isSubcommandHelpRequest(['info', '--help'])).toBe(true);
      expect(isSubcommandHelpRequest(['info', '-h'])).toBe(true);
      expect(isSubcommandHelpRequest(['info', '~zod/test', '--help'])).toBe(
        false
      );
    });

    it('detects command-only help only in the first slot', () => {
      expect(isCommandHelpRequest(['--help'])).toBe(true);
      expect(isCommandHelpRequest(['-h'])).toBe(true);
      expect(isCommandHelpRequest(['chat/~zod/test', '--help'])).toBe(false);
    });
  });

  describe('undottedPostId', () => {
    it('strips dots and any author or channel prefix', () => {
      expect(undottedPostId('170.141.184.507')).toBe('170141184507');
      expect(undottedPostId('170141184507')).toBe('170141184507');
      expect(undottedPostId('~bus/170.141.184.507')).toBe('170141184507');
    });

    it('rejects ids that are not numeric', () => {
      for (const id of ['abc', '170.1x', '', '~bus/', '-12']) {
        expect(() => undottedPostId(id)).toThrow(`Invalid post id: ${id}`);
      }
    });
  });

  describe('dmWritTime', () => {
    it('is the dotted @da of the sent time', () => {
      const sent = 1700000000000;
      const time = dmWritTime(sent);

      expect(time).toBe(formatPostId(da.fromUnix(sent).toString()));
      expect(time.replace(/\./g, '')).toBe(da.fromUnix(sent).toString());
      expect(time).toMatch(/^\d{1,3}(\.\d{3})+$/);
    });
  });
});
