import { useEffect, useState } from 'react';
import ob from 'urbit-ob';
import { DOMParser as PMDomParser, Node, Schema } from '@tiptap/pm/model';
import { Content, Editor } from '@tiptap/core';
import { deSig } from '@urbit/api';
import { marked } from 'marked';
import {
  MarkdownSerializer,
  defaultMarkdownSerializer,
  MarkdownSerializerState,
} from 'prosemirror-markdown';
import Blockquote from '@tiptap/extension-blockquote';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import Mention from '@tiptap/extension-mention';
import Paragraph from '@tiptap/extension-paragraph';
import HardBreak from '@tiptap/extension-hard-break';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { PATP_REGEX, REF_REGEX } from '@/logic/utils';
import PrismCodeBlock from './PrismCodeBlock';
import DiaryImageNode from './DiaryImageNode';
import DiaryCiteNode from './DiaryCiteNode';

const tableMap = new WeakMap();
const isInTable = (node: Node) => tableMap.has(node);

const renderHardBreak = (
  state: MarkdownSerializerState,
  node: Node,
  parent: Node,
  index: number
) => {
  const br = isInTable(parent) ? '<br>' : '\\\n';
  for (let i = index + 1; i < parent.childCount; i += 1) {
    if (parent.child(i).type !== node.type) {
      state.write(br);
      return;
    }
  }
};

const renderOrderedList = (state: MarkdownSerializerState, node: Node) => {
  const { parens } = node.attrs;
  const start = node.attrs.start || 1;
  const maxW = String(start + node.childCount - 1).length;
  const space = state.repeat(' ', maxW + 2);
  const delimiter = parens ? ')' : '.';
  state.renderList(node, space, (i) => {
    const nStr = String(start + i);
    return `${state.repeat(' ', maxW - nStr.length) + nStr}${delimiter} `;
  });
};

const replaceMention = (el: Element) => {
  if (el.innerHTML.includes('path=')) {
    return;
  }
  const text = el.innerHTML;
  const newText = text.replace(PATP_REGEX, (match) => {
    if (ob.isValidPatp(match)) {
      return `<span data-type="mention" data-id="${deSig(
        match
      )}">${match}</span>`;
    }
    return match;
  });
  // eslint-disable-next-line no-param-reassign
  el.innerHTML = newText;
};

const replaceCite = (el: Element) => {
  const text = el.innerHTML;
  const newText = text.replace(
    REF_REGEX,
    (match) => `<div path="${match}"></div>`
  );
  // eslint-disable-next-line no-param-reassign
  el.innerHTML = newText;
};

const unwrapElement = (el: Element) => {
  const parent = el.parentNode;

  if (!parent) {
    return;
  }

  // create a div to wrap the img
  const wrapper = document.createElement('div');

  // move the img to the new wrapper
  wrapper.appendChild(el.cloneNode(true));

  // insert the wrapper after the parent p in the body
  parent.parentNode?.insertBefore(wrapper, parent.nextSibling);

  // remove the original img
  parent.removeChild(el);
};

const unwrapImages = (el: Element) => {
  const images = el.querySelectorAll('img');

  images.forEach(unwrapElement);
};

const parseHTML = (str: string) => {
  // we need to parse the HTML to handle mentions, citations and images
  const parser = new DOMParser();
  const doc = parser.parseFromString(str, 'text/html');
  const paragraphs = doc.querySelectorAll('p');
  const listItems = doc.querySelectorAll('li');
  paragraphs.forEach(replaceCite);
  paragraphs.forEach(replaceMention);
  listItems.forEach(replaceMention);
  paragraphs.forEach(unwrapImages);

  // remove wrapping divs for images
  doc.body.innerHTML.replace(/<div>(.*?)<\/div>/g, '$1');

  // wrap all text that starts with \n in <p>
  doc.body.innerHTML = doc.body.innerHTML.replace(
    /(^|\n)([^\n]+)/g,
    '<p>$2</p>'
  );

  // remove empty paragraphs
  doc.body.innerHTML = doc.body.innerHTML.replace(/<p><\/p>/g, '');

  return doc.body.innerHTML;
};

const serializerMarks = {
  ...defaultMarkdownSerializer.marks,
  [Bold.name]: defaultMarkdownSerializer.marks.strong,
  [Strike.name]: {
    open: '~~',
    close: '~~',
    mixable: true,
    expelEnclosingWhitespace: true,
  },
  [Italic.name]: {
    open: '_',
    close: '_',
    mixable: true,
    expelEnclosingWhitespace: true,
  },
  [Code.name]: defaultMarkdownSerializer.marks.code,
};

const serializerNodes = {
  ...defaultMarkdownSerializer.nodes,
  [Paragraph.name]: defaultMarkdownSerializer.nodes.paragraph,
  [BulletList.name]: defaultMarkdownSerializer.nodes.bullet_list,
  [ListItem.name]: defaultMarkdownSerializer.nodes.list_item,
  [HorizontalRule.name]: defaultMarkdownSerializer.nodes.horizontal_rule,
  [OrderedList.name]: renderOrderedList,
  [HardBreak.name]: renderHardBreak,
  [PrismCodeBlock.name]: (state: MarkdownSerializerState, node: Node) => {
    state.write(`\`\`\`${node.attrs.language || ''}\n`);
    state.text(node.textContent, false);
    state.ensureNewLine();
    state.write('```');
    state.closeBlock(node);
  },
  [Blockquote.name]: (state: MarkdownSerializerState, node: Node) => {
    if (node.attrs.multiline) {
      state.write('>>>');
      state.ensureNewLine();
      state.renderContent(node);
      state.ensureNewLine();
      state.write('>>>');
      state.closeBlock(node);
    } else {
      state.wrapBlock('> ', null, node, () => state.renderContent(node));
    }
  },
  [Mention.name]: (state: MarkdownSerializerState, node: Node) => {
    state.write(`~${node.attrs.id}`);
  },
  [DiaryImageNode.name]: (state: MarkdownSerializerState, node: Node) => {
    state.write(`![${node.attrs.alt}](${node.attrs.src})`);
    state.ensureNewLine();
  },
  [DiaryCiteNode.name]: (state: MarkdownSerializerState, node: Node) => {
    state.write(node.attrs.path);
    state.ensureNewLine();
  },
};

function serialize(schema: Schema, content: Content) {
  const proseMirrorDocument = schema.nodeFromJSON(content);
  const serializer = new MarkdownSerializer(serializerNodes, serializerMarks);

  return serializer.serialize(proseMirrorDocument, {
    tightLists: true,
  });
}

function deserialize(schema: Schema, markdown: string) {
  const html = marked.parse(markdown);

  if (!html) {
    return null;
  }

  const parser = new DOMParser();
  const { body } = parser.parseFromString(parseHTML(html), 'text/html');

  const state = PMDomParser.fromSchema(schema).parse(body);

  return state.toJSON();
}

export default function DiaryMarkdownEditor({ editor }: { editor: Editor }) {
  const [markdownInput, setMarkdownInput] = useState('');

  useEffect(() => {
    setMarkdownInput(serialize(editor.schema, editor.getJSON()));
  }, [editor]);

  useEffect(() => {
    const newContent = deserialize(editor.schema, markdownInput);
    editor.commands.setContent(newContent);
  }, [markdownInput, editor]);

  return (
    <div className="h-[600px] w-full">
      <textarea
        value={markdownInput}
        onChange={(e) => setMarkdownInput(e.target.value)}
        className="input h-full w-full"
      />
    </div>
  );
}
