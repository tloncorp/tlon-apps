import React, { useState, useRef, useEffect } from 'react';
import { findLast } from 'lodash';
import cn from 'classnames';
import { useFormContext } from 'react-hook-form';
import { NoteEssay } from '@/types/diary';
import { useCalm } from '@/state/settings';
import { UploadErrorPopover } from '@/chat/ChatInput/ChatInput';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import useFileUpload from '@/logic/useFileUpload';
import { useFileStore } from '@/state/storage';

interface CoverImageInputProps {
  className?: string;
  url?: string;
}

export default function CoverImageInput({
  className = '',
  url,
}: CoverImageInputProps) {
  const { register, watch, setValue } =
    useFormContext<Pick<NoteEssay, 'title' | 'image'>>();
  const image = watch('image');
  const calm = useCalm();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { loaded, hasCredentials, promptUpload } = useFileUpload();
  const fileId = useRef(`chat-input-${Math.floor(Math.random() * 1000000)}`);
  const mostRecentFile = useFileStore((state) =>
    findLast(state.files, ['for', fileId.current])
  );

  useEffect(() => {
    if (
      mostRecentFile &&
      mostRecentFile.status === 'error' &&
      mostRecentFile.errorMessage
    ) {
      setUploadError(mostRecentFile.errorMessage);
    }

    if (mostRecentFile && mostRecentFile.status === 'success') {
      setValue('image', mostRecentFile.url);
    }
  }, [mostRecentFile, setValue]);

  return (
    <div
      className={cn(
        'relative h-36 w-full rounded-lg bg-gray-100 bg-cover bg-center px-4',
        className
      )}
      style={
        image && !calm.disableRemoteContent
          ? { backgroundImage: `url(${image})` }
          : {}
      }
    >
      <div className="absolute bottom-0 left-0 w-full p-4">
        {!image && (
          <label className="mb-1 block font-semibold text-gray-400">
            Optional Cover Image
          </label>
        )}
        <div className="input items-center justify-end">
          <input
            type="url"
            {...register('image')}
            defaultValue={url}
            placeholder="Insert URL Here..."
            className="input-inner w-full p-0"
          />
          {loaded && hasCredentials ? (
            <button
              title={'Upload an image'}
              className="small-button whitespace-nowrap"
              aria-label="Add attachment"
              onClick={(e) => {
                e.preventDefault();
                promptUpload(fileId.current);
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
        </div>
      </div>
    </div>
  );
}
