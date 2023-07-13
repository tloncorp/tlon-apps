import { Mark, Node, Schema } from '@tiptap/pm/model';

const schema = new Schema({
  nodes: {
    doc: {
      content: 'block+',
    },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() {
        return ['p', 0];
      },
    },
    blockquote: {
      content: 'block+',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'blockquote' }],
      toDOM() {
        return ['blockquote', 0];
      },
    },
    bulletList: {
      content: 'listItem+',
      group: 'block list',
      parseDOM: [{ tag: 'ul' }],
      toDOM() {
        return ['ul', 0];
      },
    },
    codeBlock: {
      content: 'text*',
      code: true,
      defining: true,
      group: 'block',
      marks: '',
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM() {
        return ['pre', ['code', 0]];
      },
    },
    'diary-cite': {
      name: 'diary-cite',
      inline: false,
      group: 'block',
      attrs: {
        path: {
          default: '',
        },
      },
      parseDOM: [
        {
          tag: 'div',
        },
      ],
      toDOM({ attrs }: { attrs: any }) {
        return ['div', attrs];
      },
    },
    'diary-image': {
      name: 'diary-image',
      inline: false,
      group: 'block',
      attrs: {
        src: {
          default: null,
        },
        alt: {
          default: '',
        },
        height: {
          default: 0,
        },
        width: {
          default: 0,
        },
      },
    },
    parseDOM: [
      {
        tag: 'img[src]',
      },
    ],
    toDOM({ attrs }: { attrs: any }) {
      return ['img', attrs];
    },
    text: {
      group: 'inline',
    },
    hardBreak: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM() {
        return ['br'];
      },
    },
    heading: {
      attrs: {
        level: {
          default: 1,
        },
      },
      content: 'inline*',
      defining: true,
      group: 'block',
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 4 } },
        { tag: 'h5', attrs: { level: 5 } },
        { tag: 'h6', attrs: { level: 6 } },
      ],
      toDOM(node: Node) {
        return [`h${node.attrs.level}`, 0];
      },
    },
    horizontalRule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM() {
        return ['hr'];
      },
    },
    listItem: {
      content: 'paragraph block*',
      defining: true,
      parseDOM: [{ tag: 'li' }],
      toDOM() {
        return ['li', 0];
      },
    },
    mention: {
      atom: true,
      attrs: {
        id: {
          default: null,
        },
        label: {
          default: null,
        },
      },
      group: 'inline',
      inline: true,
      selectable: false,
      // attrs: {
      // id: {
      // default: null,
      // parseHTML: (element: HTMLElement) => element.getAttribute('data-id'),
      // renderHTML: (attributes: any) => {
      // if (!attributes.id) {
      // return {};
      // }

      // return {
      // 'data-id': attributes.id,
      // };
      // },
      // },

      // label: {
      // default: null,
      // parseHTML: (element: HTMLElement) =>
      // element.getAttribute('data-label'),
      // renderHTML: (attributes: any) => {
      // if (!attributes.label) {
      // return {};
      // }

      // return {
      // 'data-label': attributes.label,
      // };
      // },
      // },
      // },
      parseDOM: [
        {
          tag: 'span[data-type="mention"]',
          getAttrs: (node: HTMLElement | string) => {
            console.log({ node });
            if (typeof node === 'string') {
              return {};
            }
            const id = node.getAttribute('data-mention-id');
            const label = node.textContent;

            return {
              'data-id': id,
              label,
            };
          },
        },
      ],
      toDOM(node: Node) {
        console.log({ node });
        return [
          'span',
          {
            class: 'mention',
            'data-id': node.attrs.id,
          },
          // `@${node.attrs.label}`,
        ];
      },
    },
    orderedList: {
      attrs: {
        start: {
          default: 1,
        },
      },
      content: 'listItem+',
      group: 'block list',
      parseDOM: [{ tag: 'ol' }],
      toDOM() {
        return ['ol', 0];
      },
    },
  },
  marks: {
    bold: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
      toDOM() {
        return ['strong', 0];
      },
    },
    italic: {
      parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
      toDOM() {
        return ['em', 0];
      },
    },
    underline: {
      parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
      toDOM() {
        return ['u', 0];
      },
    },
    strike: {
      parseDOM: [
        { tag: 's' },
        { tag: 'del' },
        { style: 'text-decoration=line-through' },
      ],
      toDOM() {
        return ['s', 0];
      },
    },
    code: {
      code: true,
      excludes: '_',
      parseDOM: [{ tag: 'code' }],
      toDOM() {
        return ['code', 0];
      },
    },
    link: {
      attrs: {
        href: {
          default: null,
        },
        class: {
          default: null,
        },
        target: {
          default: '_blank',
        },
      },
      inclusive: true,
      parseDOM: [
        {
          tag: 'a[href]:not([href *= "javascript:" i])',
          getAttrs: (node: HTMLElement | string) => {
            if (typeof node === 'string') {
              return {};
            }

            return {
              href: node.getAttribute('href'),
              class: node.getAttribute('class'),
              target: node.getAttribute('target'),
            };
          },
        },
      ],
      toDOM(mark: Mark) {
        return ['a', mark.attrs, 0];
      },
    },
  },
});

export default schema;
