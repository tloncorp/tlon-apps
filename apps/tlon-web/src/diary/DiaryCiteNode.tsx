import ContentReference from '@/components/References/ContentReference';
import Sig16Icon from '@/components/icons/Sig16Icon';
import { pathToCite } from '@/logic/utils';
import { Node, NodeViewProps, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import React from 'react';

import useDiaryNode from './useDiaryNode';

function DiaryCiteComponent(props: NodeViewProps) {
  const { ...bind } = useDiaryNode('path', props);
  const { path } = props.node.attrs;
  const cite = pathToCite(path);

  return (
    <NodeViewWrapper>
      <div className="not-prose rounded-xl bg-gray-100 p-3">
        {cite && (
          <div className="mb-2 text-base">
            <ContentReference cite={cite} />
          </div>
        )}
        <div className="input flex items-center space-x-3 rounded-lg bg-white p-2">
          <Sig16Icon className="h-4 w-4" />
          <input
            className="input-transparent w-full flex-1 bg-transparent leading-5"
            {...bind}
            placeholder="Paste an urbit reference"
          />
          <button
            title="Remove"
            className="small-button"
            onClick={props.deleteNode}
          >
            Remove
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

const DiaryCiteNode = Node.create({
  name: 'diary-cite',
  inline: false,
  group: 'block',
  addAttributes() {
    return {
      path: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DiaryCiteComponent);
  },
});

export default DiaryCiteNode;
