import { ParseRule } from '@tiptap/pm/model';

const parserRules: ParseRule[] = [
  {
    tag: 'ul[data-type="taskList"]',
    node: 'taskList',
  },
  {
    tag: 'li[data-type="taskItem"]',
    node: 'taskItem',
    getAttrs: (node: string | HTMLElement) => {
      if (typeof node === 'string') {
        return {};
      }

      return {
        checked: node.getAttribute('data-checked') === 'true',
      };
    },
  },
  { tag: 'p', node: 'paragraph' },
  { tag: 'blockquote', node: 'blockquote' },
  { tag: 'ul', node: 'bulletList' },
  { tag: 'ol', node: 'orderedList' },
  { tag: 'li', node: 'listItem' },
  { tag: 'hr', node: 'horizontalRule' },
  { tag: 'code', mark: 'code' },
  {
    tag: 'pre',
    node: 'codeBlock',
    preserveWhitespace: 'full',
    getAttrs: (node: HTMLElement | string) => {
      if (typeof node === 'string') {
        return {};
      }
      const child = node.firstChild as HTMLElement;
      const language = child.getAttribute('class')?.replace('language-', '');

      return {
        language,
      };
    },
  },
  {
    tag: 'div',
    node: 'diary-cite',
    getAttrs: (node: HTMLElement | string) => {
      if (typeof node === 'string') {
        return {};
      }

      return { path: node.getAttribute('path') };
    },
  },
  {
    tag: 'h1',
    node: 'heading',
    getAttrs: (node: HTMLElement | string) => {
      if (typeof node === 'string') {
        return {};
      }

      return { level: 1 };
    },
  },
  {
    tag: 'h2',
    node: 'heading',
    getAttrs: (node: HTMLElement | string) => {
      if (typeof node === 'string') {
        return {};
      }

      return { level: 2 };
    },
  },
  {
    tag: 'h3',
    node: 'heading',
    getAttrs: (node: HTMLElement | string) => {
      if (typeof node === 'string') {
        return {};
      }

      return { level: 3 };
    },
  },
  {
    tag: 'h4',
    node: 'heading',
    getAttrs: (node: HTMLElement | string) => {
      if (typeof node === 'string') {
        return {};
      }

      return { level: 4 };
    },
  },
  {
    tag: 'h5',
    node: 'heading',
    getAttrs: (node: HTMLElement | string) => {
      if (typeof node === 'string') {
        return {};
      }

      return { level: 5 };
    },
  },
  {
    tag: 'h6',
    node: 'heading',
    getAttrs: (node: HTMLElement | string) => {
      if (typeof node === 'string') {
        return {};
      }

      return { level: 6 };
    },
  },
  { tag: 'br', node: 'hardBreak' },
  { tag: 'strong', mark: 'bold' },
  { tag: 'b', mark: 'bold' },
  { tag: 'em', mark: 'italic' },
  { tag: 'i', mark: 'italic' },
  {
    tag: 'a',
    mark: 'link',
    getAttrs: (node: HTMLElement | string) => {
      if (typeof node === 'string') {
        return {};
      }

      return { href: node.getAttribute('href') };
    },
  },
  {
    tag: 'span[data-type="mention"]',
    node: 'mention',
    getAttrs: (node: HTMLElement | string) => {
      if (typeof node === 'string') {
        return {};
      }

      return {
        id: node.getAttribute('data-id'),
      };
    },
  },
  {
    tag: 'img',
    node: 'diary-image',
    getAttrs: (node: string | HTMLElement) => {
      if (typeof node === 'string') {
        return {};
      }
      return {
        src: node.getAttribute('src'),
        alt: node.getAttribute('alt'),
      };
    },
  },
];

export default parserRules;
