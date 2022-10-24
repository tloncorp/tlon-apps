import React, { useCallback, ChangeEvent, useEffect } from 'react';
import _ from 'lodash';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { dateToDa, deSig } from '@urbit/api';
import { useFileStore, useStorage } from '@/state/storage';
import { Upload, UploadInputProps } from '@/types/storage';
import api from '../api';

const UploadInput = React.forwardRef<HTMLInputElement, UploadInputProps>(
  (props, ref) => {
    const { multiple, ...rest } = props;
    const { s3, ...storage } = useStorage();
    const { credentials } = s3;
    const {
      setFiles,
      createClient,
      setStatus,
      setFileStatus,
      setFileURL,
      ...fs
    } = useFileStore();

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
      async (upload) => {
        const { file, key } = upload;
        if (fs.client) {
          setFileStatus([key, 'loading']);
          const command = new PutObjectCommand({
            Bucket: s3.configuration.currentBucket,
            Key: key,
            Body: file,
            ContentType: file.type,
            ContentLength: file.size,
            ACL: 'public-read',
          });
          const url = await getSignedUrl(fs.client, command);
          const uploadData = fs.client
            .send(command)
            .then(() => {
              setFileStatus([key, 'success']);
              setFileURL([key, url.split('?')[0]]);
            })
            .catch((error: unknown) => {
              setFileStatus([key, 'error']);
              console.error(error);
            });
          return uploadData;
        }
        setStatus('error');
        return false;
      },
      [fs, s3, setStatus, setFileStatus, setFileURL]
    );

    const onFiles = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const newFiles = _.keyBy(
          [...e.target.files].map((file) => ({
            file,
            key: `${window.ship}/${deSig(
              dateToDa(new Date())
            )}-${encodeURIComponent(file.name)}`,
            for: e.target.id,
            status: 'initial',
            url: '',
          })),
          'key'
        );
        _.map(newFiles, (file: Upload) => setFiles(file));
        _.map(newFiles, (file) => uploadFile(file));
      },
      [setFiles, uploadFile]
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
