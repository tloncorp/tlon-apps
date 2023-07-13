import { useEffect, useState } from 'react';
import ob from 'urbit-ob';
// currently importing from tiptap, but this could be imported directly from
// prosemirror when/if we ditch tiptap
import { DOMParser as PMDomParser, Node, Schema } from '@tiptap/pm/model';
import { marked } from 'marked';
import {
  MarkdownSerializer,
  defaultMarkdownSerializer,
  MarkdownSerializerState,
} from 'prosemirror-markdown';
import { JSONContent } from '@/types/content';
import { PATP_REGEX, REF_REGEX } from '@/logic/utils';
import PrismCodeBlock from './PrismCodeBlock';
import schema from './schema';
import parserRules from './parserRules';

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
      return `<span data-type="mention" data-id="${match}">${match}</span>`;
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
  const parent = el.parentNode as HTMLElement;

  if (!parent) {
    return;
  }

  // clone the original element
  const clonedEl = el.cloneNode(true) as HTMLElement;

  // split remaining text of the parent if there is any after the img
  if (el.nextSibling) {
    const nextP = document.createElement('p');
    while (el.nextSibling) {
      nextP.appendChild(el.nextSibling);
    }
    parent.parentNode?.insertBefore(nextP, parent.nextSibling);
  }

  // insert the cloned img after the parent p in the body
  parent.parentNode?.insertBefore(clonedEl, parent.nextSibling);

  // remove the original img
  el.remove();
};

const unwrapImages = (el: Element) => {
  const images = el.querySelectorAll('img');

  images.forEach(unwrapElement);
};

const parseHTML = (str: string) => {
  // we need to parse the HTML to handle mentions, citations and images
  const parser = new DOMParser();
  const doc = parser.parseFromString(str, 'text/html');
  let paragraphs = doc.querySelectorAll('p');
  const listItems = doc.querySelectorAll('li');
  paragraphs.forEach(unwrapImages);

  // re-query for paragraphs after unwrapImages operation
  paragraphs = doc.querySelectorAll('p');

  paragraphs.forEach(replaceCite);
  paragraphs.forEach(replaceMention);
  listItems.forEach(replaceMention);

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
  bold: defaultMarkdownSerializer.marks.strong,
  strike: {
    open: '~~',
    close: '~~',
    mixable: true,
    expelEnclosingWhitespace: true,
  },
  italic: {
    open: '_',
    close: '_',
    mixable: true,
    expelEnclosingWhitespace: true,
  },
  code: defaultMarkdownSerializer.marks.code,
};

const serializerNodes = {
  ...defaultMarkdownSerializer.nodes,
  paragraph: defaultMarkdownSerializer.nodes.paragraph,
  bulletList: defaultMarkdownSerializer.nodes.bullet_list,
  listItem: defaultMarkdownSerializer.nodes.list_item,
  horizontalRule: defaultMarkdownSerializer.nodes.horizontal_rule,
  orderedList: renderOrderedList,
  hardBreak: renderHardBreak,
  [PrismCodeBlock.name]: (state: MarkdownSerializerState, node: Node) => {
    state.write(`\`\`\`${node.attrs.language || ''}\n`);
    state.text(node.textContent, false);
    state.ensureNewLine();
    state.write('```');
    state.closeBlock(node);
  },
  blockquote: (state: MarkdownSerializerState, node: Node) => {
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
  mention: (state: MarkdownSerializerState, node: Node) => {
    state.write(`${node.attrs.id}`);
  },
  'diary-image': (state: MarkdownSerializerState, node: Node) => {
    state.write(`![${node.attrs.alt}](${node.attrs.src})`);
    state.ensureNewLine();
  },
  'diary-cite': (state: MarkdownSerializerState, node: Node) => {
    state.write(node.attrs.path);
    state.ensureNewLine();
  },
};

function serialize(_schema: Schema, content: JSONContent) {
  const proseMirrorDocument = _schema.nodeFromJSON(content);
  const serializer = new MarkdownSerializer(serializerNodes, serializerMarks);

  return serializer.serialize(proseMirrorDocument, {
    tightLists: true,
  });
}

function deserialize(_schema: Schema, markdown: string) {
  const html = marked.parse(markdown);

  if (!html) {
    return null;
  }

  const parser = new DOMParser();
  const { body } = parser.parseFromString(parseHTML(html), 'text/html');

  const pmParser = new PMDomParser(_schema, parserRules);

  const state = pmParser.parse(body);

  return state.toJSON();
}

export default function DiaryMarkdownEditor({
  editorContent,
  setEditorContent,
  updateMarkdown,
  setUpdateMarkdown,
  setUpdateTipTap,
}: {
  editorContent: JSONContent | null;
  setEditorContent: (content: JSONContent) => void;
  updateMarkdown: boolean;
  setUpdateMarkdown: (update: boolean) => void;
  setUpdateTipTap: (update: boolean) => void;
}) {
  const [markdownInput, setMarkdownInput] = useState('');

  useEffect(() => {
    if (editorContent && (markdownInput === '' || updateMarkdown)) {
      const markdown = serialize(schema, editorContent);
      setMarkdownInput(markdown);
      setUpdateMarkdown(false);
    }
  }, [editorContent, markdownInput, updateMarkdown, setUpdateMarkdown]);

  useEffect(() => {
    const newContent = deserialize(schema, markdownInput);
    setEditorContent(newContent);
    setUpdateTipTap(true);
  }, [markdownInput, setEditorContent, setUpdateTipTap]);

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
