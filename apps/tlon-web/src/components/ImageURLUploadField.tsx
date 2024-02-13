import { UploadErrorPopover } from '@/chat/ChatInput/ChatInput';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import LinkIcon from '@/components/icons/LinkIcon';
import { isValidUrl } from '@/logic/utils';
import { useUploader } from '@/state/storage';
import cn from 'classnames';
import React, { useEffect, useState } from 'react';
import { UseFormRegister, UseFormSetValue } from 'react-hook-form';

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
  const uploader = useUploader(`image-url-input-${formValue}`);
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
    <div className="input flex h-8 w-full items-center justify-end">
      <div className="relative mr-2 w-full">
        <input
          className="input-inner w-full p-0"
          onFocus={() => setIsFocused(true)}
          {...formRegister(formValue, {
            onBlur: () => setIsFocused(false),
            validate: (value: string) =>
              value && value.length ? isValidUrl(value) : true,
          })}
        />
        {!isFocused && !urlHasLength ? (
          <div className="pointer-events-none absolute left-0 top-0 flex h-full w-full cursor-pointer items-center">
            <LinkIcon className="mr-1 inline h-4 w-4 shrink-0 fill-gray-100" />
            <span className="pointer-events-none">Paste an image URL</span>
          </div>
        ) : null}
      </div>
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
