import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import cn from 'classnames';
import React, { ChangeEvent } from 'react';
import useDiaryNode from './useDiaryNode';

function DiaryImageComponent(props: any) {
  const className = '';
  const { value: src, ...bind } = useDiaryNode('src', props);

  return (
    <NodeViewWrapper>
      <div
        className={cn(
          'relative h-36 w-full rounded-lg bg-gray-100 bg-cover bg-center px-4',
          className
        )}
        style={src ? { backgroundImage: `url(${src})` } : {}}
      >
        <input type="text" value={src} {...bind} />
      </div>
    </NodeViewWrapper>
  );
}

const DiaryImageNode = Node.create({
  name: 'diary-image',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  inline: false,
  group: 'block',
  addAttributes() {
    return {
      src: {
        default: null,
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
        tag: 'img[src]',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', HTMLAttributes];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DiaryImageComponent);
  },
});

export default DiaryImageNode;
