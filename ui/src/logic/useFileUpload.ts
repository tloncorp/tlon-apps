import { useCallback, ChangeEvent, useEffect, useState } from 'react';
import _ from 'lodash';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { dateToDa, deSig } from '@urbit/api';
import { useFileStore, useStorage } from '@/state/storage';
import { Upload, UploadInputProps } from '@/types/storage';
import api from '../api';

function useFileUpload() {
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
  const [hasCredentials, setHasCredentials] = useState(false);

  useEffect(() => {
    useStorage.getState().initialize(api);
  }, []);

  useEffect(() => {
    const hasCreds =
      credentials?.accessKeyId &&
      credentials?.endpoint &&
      credentials?.secretAccessKey;
    if (hasCreds) {
      setHasCredentials(true);
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

  const promptUpload = useCallback(
    (fileId: string) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.id = fileId;
      input.accept = 'image/*,video/*,audio/*';
      input.addEventListener('change', (e) => {
        onFiles(e as any);
      });
      input.click();
    },
    [onFiles]
  );

  return {
    storage,
    hasCredentials,
    loaded: storage.loaded,
    promptUpload,
  };
}

export default useFileUpload;
