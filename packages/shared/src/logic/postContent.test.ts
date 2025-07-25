import { describe, expect, test } from 'vitest';

import {
  type BlockData,
  type EmbedBlockData,
  type LinkBlockData,
  findExistingBlockByUrl,
  hasExistingBlockByUrl,
} from './postContent';

describe('postContent URL helpers', () => {
  // Test data setup
  const mockEmbedBlock: EmbedBlockData = {
    type: 'embed',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    content: 'Rick Astley - Never Gonna Give You Up',
  };

  const mockLinkBlock: LinkBlockData = {
    type: 'link',
    url: 'https://example.com',
    title: 'Example Site',
    description: 'A test website',
  };

  const mockParagraphBlock: BlockData = {
    type: 'paragraph',
    content: [{ type: 'text', text: 'Hello world' }],
  };

  const mockImageBlock: BlockData = {
    type: 'image',
    src: 'https://example.com/image.jpg',
    height: 400,
    width: 600,
    alt: 'Test image',
  };

  describe('findExistingBlockByUrl', () => {
    test('returns index of embed block with matching URL', () => {
      const blocks = [mockParagraphBlock, mockEmbedBlock, mockImageBlock];
      const result = findExistingBlockByUrl(
        blocks,
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      );
      expect(result).toBe(1);
    });

    test('returns index of link block with matching URL', () => {
      const blocks = [mockParagraphBlock, mockLinkBlock, mockImageBlock];
      const result = findExistingBlockByUrl(blocks, 'https://example.com');
      expect(result).toBe(1);
    });

    test('returns -1 when no matching URL is found', () => {
      const blocks = [mockParagraphBlock, mockImageBlock];
      const result = findExistingBlockByUrl(blocks, 'https://not-found.com');
      expect(result).toBe(-1);
    });

    test('returns -1 for empty blocks array', () => {
      const blocks: BlockData[] = [];
      const result = findExistingBlockByUrl(blocks, 'https://example.com');
      expect(result).toBe(-1);
    });

    test('returns first matching block when multiple blocks have same URL', () => {
      const duplicateEmbed: EmbedBlockData = {
        type: 'embed',
        url: 'https://example.com',
        content: 'First embed',
      };

      const duplicateLink: LinkBlockData = {
        type: 'link',
        url: 'https://example.com',
        title: 'Same URL link',
      };

      const blocks = [mockParagraphBlock, duplicateEmbed, duplicateLink];
      const result = findExistingBlockByUrl(blocks, 'https://example.com');
      expect(result).toBe(1); // Should return first match (embed)
    });

    test('handles URL case sensitivity correctly', () => {
      const blocks = [mockLinkBlock]; // has https://example.com
      const result = findExistingBlockByUrl(blocks, 'https://EXAMPLE.COM');
      expect(result).toBe(-1); // Should not match due to case sensitivity
    });

    test('ignores blocks that do not have URL property', () => {
      const blocks = [mockParagraphBlock, mockImageBlock, mockEmbedBlock];
      const result = findExistingBlockByUrl(
        blocks,
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      );
      expect(result).toBe(2); // Should find the embed block, ignoring paragraph and image
    });
  });

  describe('hasExistingBlockByUrl', () => {
    test('returns true when embed block with URL exists', () => {
      const blocks = [mockParagraphBlock, mockEmbedBlock];
      const result = hasExistingBlockByUrl(
        blocks,
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      );
      expect(result).toBe(true);
    });

    test('returns true when link block with URL exists', () => {
      const blocks = [mockParagraphBlock, mockLinkBlock];
      const result = hasExistingBlockByUrl(blocks, 'https://example.com');
      expect(result).toBe(true);
    });

    test('returns false when no matching URL is found', () => {
      const blocks = [mockParagraphBlock, mockImageBlock];
      const result = hasExistingBlockByUrl(blocks, 'https://not-found.com');
      expect(result).toBe(false);
    });

    test('returns false for empty blocks array', () => {
      const blocks: BlockData[] = [];
      const result = hasExistingBlockByUrl(blocks, 'https://example.com');
      expect(result).toBe(false);
    });

    test('returns true when multiple blocks have same URL', () => {
      const duplicateEmbed: EmbedBlockData = {
        type: 'embed',
        url: 'https://example.com',
        content: 'First embed',
      };

      const duplicateLink: LinkBlockData = {
        type: 'link',
        url: 'https://example.com',
        title: 'Same URL link',
      };

      const blocks = [duplicateEmbed, duplicateLink];
      const result = hasExistingBlockByUrl(blocks, 'https://example.com');
      expect(result).toBe(true);
    });

    test('handles special characters in URLs', () => {
      const specialUrlBlock: EmbedBlockData = {
        type: 'embed',
        url: 'https://example.com/path?query=value&other=123#fragment',
        content: 'Special URL',
      };

      const blocks = [specialUrlBlock];
      const result = hasExistingBlockByUrl(
        blocks,
        'https://example.com/path?query=value&other=123#fragment'
      );
      expect(result).toBe(true);
    });

    test('distinguishes between similar URLs', () => {
      const blocks = [mockLinkBlock]; // has https://example.com

      // Test similar but different URLs
      expect(hasExistingBlockByUrl(blocks, 'https://example.com/')).toBe(false);
      expect(hasExistingBlockByUrl(blocks, 'http://example.com')).toBe(false);
      expect(hasExistingBlockByUrl(blocks, 'https://example.com/path')).toBe(
        false
      );
      expect(hasExistingBlockByUrl(blocks, 'https://www.example.com')).toBe(
        false
      );
    });
  });

  describe('integration scenarios', () => {
    test('works with mixed block types', () => {
      const blocks: BlockData[] = [
        mockParagraphBlock,
        {
          type: 'header',
          level: 'h1',
          children: [{ type: 'text', text: 'Title' }],
        },
        mockEmbedBlock,
        {
          type: 'code',
          content: 'console.log("test")',
          lang: 'javascript',
        },
        mockLinkBlock,
        {
          type: 'rule',
        },
      ];

      expect(
        hasExistingBlockByUrl(
          blocks,
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        )
      ).toBe(true);
      expect(hasExistingBlockByUrl(blocks, 'https://example.com')).toBe(true);
      expect(hasExistingBlockByUrl(blocks, 'https://not-found.com')).toBe(
        false
      );

      expect(
        findExistingBlockByUrl(
          blocks,
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        )
      ).toBe(2);
      expect(findExistingBlockByUrl(blocks, 'https://example.com')).toBe(4);
    });

    test('handles edge case with empty URL', () => {
      const emptyUrlBlock: EmbedBlockData = {
        type: 'embed',
        url: '',
        content: 'Empty URL',
      };

      const blocks = [emptyUrlBlock];
      expect(hasExistingBlockByUrl(blocks, '')).toBe(true);
      expect(findExistingBlockByUrl(blocks, '')).toBe(0);
    });
  });
});
