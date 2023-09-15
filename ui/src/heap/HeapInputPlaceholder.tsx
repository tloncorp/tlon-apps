import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useIsMobile } from '@/logic/useMedia';
import { useUploader } from '@/state/storage';
import { Node, NodeViewProps } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  NodeViewContent,
} from '@tiptap/react';
import { useCallback } from 'react';

export type HeapInputPlaceholderOptions = {
  uploadKey: string;
};

function HeapInputPlaceholderComponent(props: NodeViewProps) {
  const isMobile = useIsMobile();
  const uploader = useUploader(props.extension.options.uploadKey);
  const mostRecentFile = uploader?.getMostRecent();
  const loading = !!(mostRecentFile && mostRecentFile.status === 'loading');

  const focus = useCallback(() => {
    props.editor.chain().clearContent().focus().run();
  }, [props]);

  return (
    <NodeViewWrapper>
      <NodeViewContent>
        <div
          tabIndex={0}
          onClick={focus}
          className="flex select-none flex-col items-start space-y-2 font-semibold text-gray-400"
        >
          {isMobile ? (
            uploader ? (
              <>
                <button
                  className="small-button flex-none"
                  disabled={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    uploader.prompt();
                  }}
                >
                  {loading ? (
                    <>
                      <LoadingSpinner className="mr-2 h-4 w-4" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    'Upload'
                  )}
                </button>
                <span>or paste a link or type to post text</span>
              </>
            ) : (
              <span>Paste a link or type to post text</span>
            )
          ) : (
            <>Drag media to upload, or start typing to post text</>
          )}
        </div>
      </NodeViewContent>
    </NodeViewWrapper>
  );
}

const HeapInputPlaceholder = Node.create<HeapInputPlaceholderOptions>({
  name: 'heap-input-placeholder',
  group: 'block',
  inline: false,
  selectable: false,
  atom: true,
  parseHTML() {
    return [
      {
        tag: 'span',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HeapInputPlaceholderComponent);
  },
});

export default HeapInputPlaceholder;
