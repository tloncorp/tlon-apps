import React, { useCallback, ChangeEvent, useRef, useEffect } from 'react';
import _ from 'lodash';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { dateToDa, deSig } from '@urbit/api';
import { useFileStore, useStorage } from '@/state/storage';
import { Upload, UploadInputProps } from '@/types/storage';
import api from '../api';

const UploadInput = React.forwardRef<HTMLInputElement, UploadInputProps>(
  (props, ref) => {
    const { multiple, ...rest } = props;
    const { s3, ...storage } = useStorage();
    const { credentials } = s3;
    const { setFiles, createClient, setStatus, ...fs } = useFileStore();

    useEffect(() => {
      useStorage.getState().initialize(api);
    }, []);

    useEffect(() => {
      const hasCredentials =
        credentials?.accessKeyId &&
        credentials?.endpoint &&
        credentials?.secretAccessKey;
      if (hasCredentials) {
        const connect = async () => {
          createClient(credentials);
        };
        connect()
          .then(() => setStatus('success'))
          .catch((error: unknown) => {
            console.error(error);
          });
      }
    }, [createClient, setStatus, credentials]);

    const uploadFile = useCallback(
      async (upload: Upload, idx: number) => {
        const timestamp = deSig(dateToDa(new Date()));
        const { file } = upload;
        if (fs.client) {
          fs.setFileStatus([idx, 'loading']);
          const uploadData = fs.client
            .send(
              new PutObjectCommand({
                Bucket: s3.configuration.currentBucket,
                Key: `${window.ship}/${timestamp}-${file.name}`,
                Body: file,
                ContentType: file.type,
                ContentLength: file.size,
                ACL: 'public-read',
              })
            )
            .then(() => {
              fs.setFileStatus([idx, 'success']);
            })
            .catch((error: unknown) => {
              fs.setFileStatus([idx, 'error']);
              console.error(error);
            });
          return uploadData;
        }
        setStatus('error');
        return false;
      },
      [fs, s3, setStatus]
    );

    const onFiles = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const newFiles = [...e.target.files].map((file) => ({
          file,
          status: 'initial',
        }));
        setFiles(newFiles);
        _.map(newFiles, (file: Upload, idx: number) => uploadFile(file, idx));
      },
      [uploadFile, setFiles]
    );

    if (storage.loaded)
      return (
        <input
          type="file"
          multiple={multiple}
          onChange={onFiles}
          ref={ref}
          {...rest}
        />
      );

    return null;
  }
);

export default UploadInput;
