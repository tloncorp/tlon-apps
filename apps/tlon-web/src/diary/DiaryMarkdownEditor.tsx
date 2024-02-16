import { PATP_REGEX, REF_REGEX } from '@/logic/utils';
import { JSONContent } from '@/types/content';
// currently importing from tiptap, but this could be imported directly from
// prosemirror when/if we ditch tiptap
import { Node, DOMParser as PMDomParser, Schema } from '@tiptap/pm/model';
import { deSig, preSig } from '@urbit/api';
import { marked } from 'marked';
import {
  MarkdownSerializer,
  MarkdownSerializerState,
  defaultMarkdownSerializer,
} from 'prosemirror-markdown';
import { useEffect, useState } from 'react';
import ob from 'urbit-ob';

import parserRules from './parserRules';
import schema from './schema';

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
    // avoid destroying the cite element
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
  // we need to parse the HTML to handle mentions, citations, images and tasks
  const parser = new DOMParser();
  const doc = parser.parseFromString(str, 'text/html');
  let paragraphs = doc.querySelectorAll('p');
  const listItems = doc.querySelectorAll('li');
  const wrappedTaskItems = doc.querySelectorAll(
    'li > p > input[type="checkbox"][disabled]'
  );

  wrappedTaskItems.forEach((el) => {
    unwrapElement(el);
  });

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

  // remove del tags within the path attribute in <div path="..."></div>
  doc.body.innerHTML = doc.body.innerHTML.replace(
    /path="([^"]*)<del>([^"]*)<\/del>([^"]*)"/g,
    'path="$1$2$3"'
  );

  // prepend valid deSigged patps within div paths with sigs
  const pathDivs = doc.querySelectorAll('div[path]');
  pathDivs.forEach((div) => {
    const path = div.getAttribute('path');
    if (path) {
      const newPath = path
        .split('/')
        .map((part) => {
          const hasSig = part.includes('~');

          if (hasSig && ob.isValidPatp(part)) {
            return part;
          }

          if (ob.isValidPatp(preSig(part))) {
            return `~${part}`;
          }
          return part;
        })
        .join('/');

      div.setAttribute('path', newPath);
    }
  });

  // prepare task items
  const taskItems = doc.querySelectorAll(
    'li > input[type="checkbox"][disabled]'
  );
  taskItems.forEach((input) => {
    const li = input.parentNode as HTMLElement;
    const checked = input.hasAttribute('checked');
    li.removeChild(input);
    const content = li.innerHTML.replace(/<p>|<\/p>/g, '');
    const newP = document.createElement('p');
    const label = document.createElement('label');
    const span = document.createElement('span');

    li.setAttribute('data-type', 'taskItem');
    li.setAttribute('data-checked', String(checked));

    input.removeAttribute('disabled');
    label.appendChild(input);
    label.appendChild(span);
    newP.innerHTML = content;
    li.innerHTML = '';
    li.appendChild(label);
    li.appendChild(newP);
  });

  const taskLists = doc.querySelectorAll('ul > li[data-type="taskItem"]');
  taskLists.forEach((li) => {
    const ul = li.parentNode as HTMLElement;
    ul.setAttribute('data-type', 'taskList');
  });

  return doc.body;
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
  codeBlock: (state: MarkdownSerializerState, node: Node) => {
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
    state.write(`~${node.attrs.id}`);
  },
  'diary-image': (state: MarkdownSerializerState, node: Node) => {
    state.write(`![${node.attrs.alt}](${node.attrs.src})`);
    state.closeBlock(node);
  },
  'diary-cite': (state: MarkdownSerializerState, node: Node) => {
    state.write(node.attrs.path);
    state.closeBlock(node);
  },
  taskList: (state: MarkdownSerializerState, node: Node) => {
    state.renderContent(node);
  },
  taskItem: (state: MarkdownSerializerState, node: Node) => {
    state.write(`- [${node.attrs.checked ? 'x' : ' '}] `);
    state.text(node.textContent, false);
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

  const pmParser = new PMDomParser(_schema, parserRules);

  const state = pmParser.parse(parseHTML(html));

  return state.toJSON();
}

export default function DiaryMarkdownEditor({
  editorContent,
  setEditorContent,
  loaded,
  newNote,
}: {
  editorContent: JSONContent | null;
  setEditorContent: (content: JSONContent) => void;
  loaded: boolean;
  newNote: boolean;
}) {
  const [markdownInput, setMarkdownInput] = useState<string | null>(null);

  useEffect(() => {
    if (editorContent && markdownInput === null && (newNote || loaded)) {
      const markdown = serialize(schema, editorContent);
      setMarkdownInput(markdown);
    }
  }, [editorContent, markdownInput, newNote, loaded]);

  useEffect(() => {
    if (markdownInput === null) {
      return;
    }
    const newContent = deserialize(schema, markdownInput);
    setEditorContent(newContent);
  }, [markdownInput, setEditorContent]);

  return (
    <textarea
      value={markdownInput ?? ''}
      onChange={(e) => setMarkdownInput(e.target.value)}
      className="input-transparent block h-full w-full resize-none pt-2 font-mono text-lg leading-8 placeholder:h-0 placeholder:text-[17px] placeholder:leading-8 placeholder:text-gray-400"
      placeholder="Start writing markdown here."
      data-testid="note-markdown-editor"
    />
  );
}
