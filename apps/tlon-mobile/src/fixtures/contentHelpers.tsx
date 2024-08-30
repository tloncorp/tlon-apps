import { faker } from '@faker-js/faker';
import type { ContentReference } from '@tloncorp/shared/dist/api';
import * as ub from '@tloncorp/shared/dist/urbit';

export const inline = {
  text: (content: string) => content,
  break: () => ({
    break: null,
  }),
  inlineCode: (content: string) => ({
    'inline-code': content,
  }),
  code: (content: string) => ({
    code: content,
  }),
  blockReference: (index: number, text: string) => ({
    block: {
      index,
      text,
    },
  }),
  link: (href: string, content: string) => ({
    link: {
      href,
      content,
    },
  }),
  bold: (...children: ub.Inline[]) => ({
    bold: children,
  }),
  italics: (...children: ub.Inline[]) => ({
    italics: children,
  }),
  strikethrough: (...children: ub.Inline[]) => ({
    strike: children,
  }),
  blockquote: (...children: ub.Inline[]) => ({
    blockquote: children,
  }),
  ship: (contactId: string) => ({
    ship: contactId,
  }),
} satisfies Record<string, (...args: any[]) => ub.Inline>;

export const listItem = {
  basic: (...children: ub.Inline[]): ub.ListItem => ({
    item: children,
  }),
  task: (checked: boolean, ...children: ub.Inline[]) => ({
    task: {
      checked,
      content: children,
    },
  }),
};

export const verse = {
  block: (content: ub.Block): ub.VerseBlock => {
    return {
      block: content,
    };
  },
  inline: (...children: ub.Inline[]): ub.VerseInline => {
    return {
      inline: children,
    };
  },
};

export const block = {
  image: ({
    width,
    height,
    alt,
    src,
  }: {
    width: number;
    height: number;
    alt: string;
    src: string;
  }) => ({
    block: {
      image: {
        width,
        height,
        alt,
        src,
      },
    },
  }),
  randomImage(width: number, height: number) {
    return this.image({
      width,
      height,
      alt: 'alt',
      src: faker.image.urlLoremFlickr({ width, height, category: 'abstract' }),
    });
  },
  header: (tag: ub.HeaderLevel, ...children: ub.Inline[]) => ({
    block: {
      header: {
        tag,
        content: children,
      },
    },
  }),
  rule: () => ({
    block: {
      rule: null,
    },
  }),
  code: (code: string, language: string) => ({
    block: {
      code: {
        code,
        lang: language,
      },
    },
  }),
  list: (type: ub.ListType, contents: ub.Inline[], items: ub.Listing[]) => ({
    block: {
      listing: list(type, contents, items),
    },
  }),
  channelReference: (channelId: string, postId: string, replyId?: string) => ({
    type: 'reference',
    referenceType: 'channel',
    channelId,
    postId,
    replyId,
  }),
  groupReference: (groupId: string) => ({
    type: 'reference',
    referenceType: 'group',
    groupId,
  }),
  appReference: (appId: string, userId: string) => ({
    type: 'reference',
    referenceType: 'app',
    appId,
    userId,
  }),
} satisfies Record<string, (...args: any[]) => ub.Verse | ContentReference>;

export function list(
  type: ub.ListType,
  contents: ub.Inline[],
  items: ub.Listing[]
) {
  return {
    list: {
      type,
      contents,
      items,
    },
  };
}
