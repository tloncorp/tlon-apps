import { UploadErrorPopover } from '@/chat/ChatInput/ChatInput';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import Asterisk16Icon from '@/components/icons/Asterisk16Icon';
import LinkIcon from '@/components/icons/LinkIcon';
import { useCalm } from '@/state/settings';
import { useUploader } from '@/state/storage';
import { Node, NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import cn from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

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
  const id = useRef(performance.now());
  const uploader = useUploader(`diary-image-input-${id.current}`);
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
          'not-prose relative w-full rounded-xl bg-gray-100 bg-cover bg-center',
          className
        )}
      >
        {src && !error && !calm?.disableRemoteContent ? (
          <img
            ref={image}
            className="w-full rounded-xl object-cover"
            src={src}
            onError={onError}
            onLoad={onLoad}
          />
        ) : (
          <div />
        )}
        <div
          className={cn(
            'w-full p-3',
            src && !error && !calm?.disableRemoteContent && 'absolute bottom-0'
          )}
        >
          <div
            className={cn(
              'input relative flex w-full items-center space-x-2 rounded-lg border border-gray-100 bg-white p-2'
            )}
          >
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
                <Asterisk16Icon className="h-4 w-4" />
                <div className="grow">Failed to Load</div>
                <button type="button" onClick={props.deleteNode}>
                  Cancel
                </button>
                <button type="button" onClick={onRetry}>
                  Retry
                </button>
              </div>
            ) : (
              <button
                title="Remove"
                className="small-button"
                onClick={props.deleteNode}
              >
                Remove
              </button>
            )}
          </div>
        </div>
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
