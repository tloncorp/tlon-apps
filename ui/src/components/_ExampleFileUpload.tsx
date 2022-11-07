import React from 'react';
import _ from 'lodash';
import UploadInput from '@/components/FileUpload';
import { useFileStore } from '@/state/storage';

// Example interface to enforce types
interface Uploader {
  id: string;
  multiple?: boolean;
}

function Uploader({ id, multiple }: Uploader) {
  // Selector based on id
  let files = useFileStore((state) => _.filter(state.files, ['for', id]));
  // Only get the latest file for the input if !multiple
  if (!multiple) {
    files = !multiple && _.takeRight(files);
  }

  return (
    <div>
      {files.length
        ? _.map(files, (file) => {
            const { url, key } = file;
            return <img key={key} src={url} />;
          })
        : null}
      <UploadInput multiple={multiple} id={id} />
    </div>
  );
}

export default function Example() {
  // Input is required, since that's what we use for the selector.
  return <Uploader id="required-input-id" />;
}
