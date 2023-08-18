import { useState, useCallback, useRef } from 'react';
import Dialog from '@/components/Dialog';
import { Status } from '@/logic/status';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { isMediaUrl } from '@/logic/utils';
import { useAddCurioMutation } from '@/state/heap/heap';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import { createCurioHeart } from '@/logic/heap';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import isURL from 'validator/lib/isURL';
import MediaPreview from './MediaPreview';

interface AddCurioModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  flag: string;
  chFlag: string;
}

function BlockInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const handleChange = (e: any) => {
    if (ref.current) {
      ref.current.style.height = '1px';
      const newHeight = ref.current.scrollHeight;
      ref.current.style.height = `${Math.min(newHeight, 350)}px`;
    }

    onChange(e.target.value);
  };

  return (
    <textarea
      className="align-center flex w-full resize-none rounded-lg bg-gray-50 p-4 leading-5 focus:outline-none focus-visible:border-none focus-visible:bg-gray-50"
      placeholder="Drag media to upload, or start typing to post text"
      rows={1}
      value={value}
      ref={ref}
      onChange={handleChange}
    />
  );
}

export default function AddCurioModal(props: AddCurioModalProps) {
  const [status, setStatus] = useState<'initial' | 'loading' | 'error'>(
    'initial'
  );
  const [mode, setMode] = useState<'preview' | 'input'>('input');
  const [inputText, setInputText] = useState('');

  const { mutate: addCurio } = useAddCurioMutation();
  const { privacy } = useGroupPrivacy(props.flag);

  function inputOnChange(newInput: string) {
    if (isMediaUrl(newInput)) {
      setMode('preview');
    }

    setInputText(newInput);
  }

  function reset() {
    setMode('input');
    setInputText('');
    setStatus('initial');
  }

  const setOpen = useCallback(
    (open: boolean) => {
      if (!open) reset();
      props.setOpen(open);
    },
    [props]
  );

  const postBlock = useCallback(async () => {
    const { flag, chFlag } = props;
    const heart = createCurioHeart(
      inputText,
      isURL(inputText) ? 'link' : 'text'
    );

    addCurio(
      { flag: chFlag, heart },
      {
        onSuccess: () => {
          captureGroupsAnalyticsEvent({
            name: 'post_item',
            groupFlag: flag,
            chFlag,
            channelType: 'heap',
            privacy,
          });
        },
        onSettled: () => {
          setOpen(false);
        },
      }
    );
  }, [props, addCurio, inputText, setOpen, privacy]);

  return (
    <Dialog
      open={props.open}
      onOpenChange={() => setOpen(false)}
      containerClass="w-[500px] h-full overflow-auto focus-visible:border-none focus:outline-none"
      className="top-32"
    >
      <div className="sm:w-96">
        <header className="mb-3 flex items-center">
          <h2 className="text-lg font-bold">Post New Block</h2>
        </header>
      </div>

      <div className="align-center mt-6 mb-6 flex w-full justify-center">
        {mode === 'input' ? (
          <BlockInput value={inputText} onChange={(e) => inputOnChange(e)} />
        ) : (
          <MediaPreview url={inputText} />
        )}
      </div>

      <footer className="mt-4 flex items-center justify-between space-x-2">
        <div className="ml-auto flex items-center space-x-2">
          <button className="secondary-button" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            onClick={() => postBlock()}
            className="button"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? (
              <LoadingSpinner className="h-4 w-4" />
            ) : status === 'error' ? (
              'Error'
            ) : (
              'Post'
            )}
          </button>
        </div>
      </footer>
    </Dialog>
  );
}
