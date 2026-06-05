import { describe, expect, it } from 'bun:test';

import {
  getOption,
  getRequiredOptionValue,
  hasOptionValue,
  isCommandHelpRequest,
  isSubcommandHelpRequest,
  looksLikePositionalChannelKind,
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
      expect(isCommandHelpRequest(['diary/~zod/test', '--help'])).toBe(false);
    });
  });
});
