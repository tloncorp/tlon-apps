import { describe, expect, it } from 'bun:test';

import {
  getOption,
  getRequiredOptionValue,
  hasOptionValue,
  isCommandHelpRequest,
  isDiaryNest,
  isSubcommandHelpRequest,
  looksLikePositionalChannelKind,
  looksLikeRemovedPositionalChannelKind,
  wantsHelp,
} from './cli-utils';

describe('cli-utils', () => {
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
});
