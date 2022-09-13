import Sig16Icon from '@/components/icons/Sig16Icon';
import ContentReference from '@/components/References/ContentReference';
import { pathToCite } from '@/logic/utils';
import { mergeAttributes, Node, NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import React from 'react';
import useDiaryNode from './useDiaryNode';

function DiaryCiteComponent(props: NodeViewProps) {
  const { ...bind } = useDiaryNode('path', props);
  const { path } = props.node.attrs;
  const cite = pathToCite(path);

  return (
    <NodeViewWrapper>
      <div className="my-4">
        <div className="mb-2 rounded-xl bg-gray-50 p-3">
          <div className="flex items-center space-x-3 rounded-lg bg-white p-2">
            <Sig16Icon className="h-4 w-4" />
            <input
              className="input-transparent w-full flex-1 bg-transparent leading-5"
              {...bind}
              placeholder="Add an urbit reference"
            />
          </div>
        </div>
        {cite && <ContentReference cite={cite} />}
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
