import { describe, expect, it } from 'vitest';

import { getPostPreviewText, isMuted } from './activity';

describe('activity logic', () => {
  describe('isMuted', () => {
    it('should return false when volume is null or undefined', () => {
      expect(isMuted(null, 'channel')).toBe(false);
      expect(isMuted(undefined, 'channel')).toBe(false);
    });

    it('should return true for channel when volume is hush', () => {
      expect(isMuted('hush', 'channel')).toBe(true);
    });

    it('should return false for channel when volume is not hush', () => {
      expect(isMuted('default', 'channel')).toBe(false);
      expect(isMuted('soft', 'channel')).toBe(false);
      expect(isMuted('loud', 'channel')).toBe(false);
    });

    it('should return true for group when volume is soft or hush', () => {
      expect(isMuted('soft', 'group')).toBe(true);
      expect(isMuted('hush', 'group')).toBe(true);
    });

    it('should return false for group when volume is default or loud', () => {
      expect(isMuted('default', 'group')).toBe(false);
      expect(isMuted('loud', 'group')).toBe(false);
    });
  });

  describe('getPostPreviewText', () => {
    it('should return "(Deleted post)" for deleted posts', () => {
      expect(
        getPostPreviewText({
          isDeleted: true,
          hidden: false,
          textContent: 'Hello',
        })
      ).toBe('(Deleted post)');
      expect(
        getPostPreviewText({
          isDeleted: true,
          hidden: true,
          textContent: 'Hello',
        })
      ).toBe('(Deleted post)');
    });

    it('should return "(Hidden post)" for hidden posts', () => {
      expect(
        getPostPreviewText({
          isDeleted: false,
          hidden: true,
          textContent: 'Hello',
        })
      ).toBe('(Hidden post)');
      expect(
        getPostPreviewText({
          isDeleted: null,
          hidden: true,
          textContent: 'Hello',
        })
      ).toBe('(Hidden post)');
    });

    it('should return text content for normal posts', () => {
      expect(
        getPostPreviewText({
          isDeleted: false,
          hidden: false,
          textContent: 'Hello world',
        })
      ).toBe('Hello world');
      expect(
        getPostPreviewText({
          isDeleted: null,
          hidden: null,
          textContent: 'Test message',
        })
      ).toBe('Test message');
    });

    it('should return empty string when text content is null/undefined', () => {
      expect(
        getPostPreviewText({
          isDeleted: false,
          hidden: false,
          textContent: null,
        })
      ).toBe('');
      expect(
        getPostPreviewText({
          isDeleted: false,
          hidden: false,
          textContent: undefined,
        })
      ).toBe('');
    });

    it('should prioritize deleted over hidden status', () => {
      expect(
        getPostPreviewText({
          isDeleted: true,
          hidden: true,
          textContent: 'Hello',
        })
      ).toBe('(Deleted post)');
    });

    it('should handle minimal post objects', () => {
      expect(getPostPreviewText({})).toBe('');
      expect(getPostPreviewText({ textContent: 'Hello' })).toBe('Hello');
    });
  });
});
