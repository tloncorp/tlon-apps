import React, { useState, useEffect } from 'react';
import cn from 'classnames';
import { UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { isValidUrl } from '@/logic/utils';
import LinkIcon from '@/components/icons/LinkIcon';
import { useUploader } from '@/state/storage';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { UploadErrorPopover } from '@/chat/ChatInput/ChatInput';

interface ImageURLUploadFieldProps {
  formRegister: UseFormRegister<any>;
  formWatchURL: string | null | undefined;
  formSetValue: UseFormSetValue<any>;
  formValue: string;
}

export default function ImageURLUploadField({
  formRegister,
  formWatchURL,
  formSetValue,
  formValue,
}: ImageURLUploadFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const urlHasLength = formWatchURL?.length;

  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploader = useUploader('image-url-input');
  const mostRecentFile = uploader?.getMostRecent();

  useEffect(() => {
    if (
      mostRecentFile &&
      mostRecentFile.status === 'error' &&
      mostRecentFile.errorMessage
    ) {
      setUploadError(mostRecentFile.errorMessage);
    }

    if (mostRecentFile && mostRecentFile.status === 'success') {
      formSetValue(formValue, mostRecentFile.url, {
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  }, [mostRecentFile, formSetValue, formValue]);

  return (
    <div className="input relative flex h-8 w-full items-center justify-end">
      <input
        className={cn('input-inner w-full py-0 pl-0 pr-2')}
        onFocus={() => setIsFocused(true)}
        {...formRegister(formValue, {
          onBlur: () => setIsFocused(false),
          validate: (value: string) =>
            value && value.length ? isValidUrl(value) : true,
        })}
      />
      {!isFocused && !urlHasLength ? (
        <div className="pointer-events-none absolute left-[0.5625rem] flex cursor-pointer items-center">
          <LinkIcon className="mr-1 inline h-4 w-4 fill-gray-100" />
          <span className="pointer-events-none">Paste an image URL</span>
        </div>
      ) : null}
      {uploader ? (
        <button
          title={'Upload an image'}
          className="small-button h-6 whitespace-nowrap"
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
    </div>
  );
}
