import React, { useState, useEffect, useRef } from 'react';
import { useCalm } from '@/state/settings';
import LinkIcon from '@/components/icons/LinkIcon';
import AsteriskIcon from '@/components/icons/Asterisk16Icon';
import { Node, NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import cn from 'classnames';
import { useUploader } from '@/state/storage';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { UploadErrorPopover } from '@/chat/ChatInput/ChatInput';
import useDiaryNode from './useDiaryNode';

function DiaryImageComponent(props: NodeViewProps) {
  const className = '';
  const { selected, getPos, editor } = props;
  const { clear, updateValues, ...bind } = useDiaryNode('src', props);
  const [error, setError] = useState(false);
  const [src, setSrc] = useState(null as string | null);
  const image = useRef<HTMLImageElement>(null);
  const calm = useCalm();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploader = useUploader('diary-image-input');
  const mostRecentFile = uploader?.getMostRecent();
  const onError = () => {
    setError(true);
  };
  useEffect(() => {
    setError(false);
  }, [src]);

  useEffect(() => {
    if (
      mostRecentFile &&
      mostRecentFile.status === 'error' &&
      mostRecentFile.errorMessage
    ) {
      setUploadError(mostRecentFile.errorMessage);
    }

    if (mostRecentFile && mostRecentFile.status === 'success') {
      setSrc(mostRecentFile.url);
      if (bind.ref.current) {
        bind.ref.current.value = mostRecentFile.url;
        updateValues(mostRecentFile.url);
      }
    }
  }, [mostRecentFile, updateValues, bind]);

  useEffect(() => {
    if (!selected) {
      setSrc(bind.value);
    }
  }, [selected, bind.value]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      editor.commands.focus(getPos() - 1);
    } else if (e.key === 'ArrowDown') {
      editor.commands.focus(getPos() + 1);
    }
  };

  const onCancel = () => {
    setSrc(null);
    clear();
    editor.chain().focus().run();
  };
  const onRetry = () => {
    setError(false);
  };

  const onLoad = () => {
    if (image.current) {
      props.updateAttributes({
        width: image.current.naturalWidth,
        height: image.current.naturalHeight,
      });
    }
  };

  return (
    <NodeViewWrapper>
      <div
        className={cn(
          'min-h-12 br-1 relative flex w-full items-center justify-center rounded-xl bg-gray-100 bg-cover bg-center',
          className
        )}
      >
        <div className="input absolute inset-x-4 bottom-4 flex h-8 items-center space-x-2 rounded-lg border border-gray-100 bg-white px-2">
          <LinkIcon className="h-4 w-4" />
          <input
            className="input-transparent grow"
            type="text"
            {...bind}
            onKeyDown={onKeyDown}
            placeholder="Enter an image/embed/web URL"
          />
          {uploader ? (
            <button
              title={'Upload an image'}
              className="small-button whitespace-nowrap"
              aria-label="Add attachment"
              onClick={(e) => {
                e.preventDefault();
                uploader.prompt();
              }}
            >
              {mostRecentFile && mostRecentFile.status === 'loading' ? (
                <LoadingSpinner secondary="black" className="h-4 w-4" />
              ) : (
                'Upload Image'
              )}
            </button>
          ) : null}
          {uploadError ? (
            <div className="absolute mr-2">
              <UploadErrorPopover
                errorMessage={uploadError}
                setUploadError={setUploadError}
              />
            </div>
          ) : null}
          {error ? (
            <div className="flex space-x-2">
              <AsteriskIcon className="h-4 w-4" />
              <div className="grow">Failed to Load</div>
              <button type="button" onClick={props.deleteNode}>
                Cancel
              </button>
              <button type="button" onClick={onRetry}>
                Retry
              </button>
            </div>
          ) : null}
        </div>
        {src && !error && !calm?.disableRemoteContent ? (
          <img
            ref={image}
            className="rounded-xl"
            src={src}
            onError={onError}
            onLoad={onLoad}
          />
        ) : (
          <div className="h-16 w-full" />
        )}
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
        default: '',
      },
      height: {
        default: 0,
      },
      width: {
        default: 0,
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
