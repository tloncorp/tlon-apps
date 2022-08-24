import { mergeAttributes, Node } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  NodeViewContent,
} from '@tiptap/react';
import cn from 'classnames';
import React, { ChangeEvent, useRef, useEffect } from 'react';
import useDiaryNode from './useDiaryNode';

function DiaryLinkComponent(props: any) {
  const className = '';
  const inputRef = useRef<HTMLInputElement>(null);
  const bind = useDiaryNode('href', props);
  return (
    <NodeViewWrapper>
      <NodeViewContent>
        <input {...bind} />
      </NodeViewContent>
    </NodeViewWrapper>
  );
}

const DiaryLinkNode = Node.create({
  name: 'diary-link',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  inline: false,
  group: 'block',
  addAttributes() {
    return {
      href: {
        default: '',
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[href]',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['a', HTMLAttributes];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DiaryLinkComponent);
  },
});

export default DiaryLinkNode;
