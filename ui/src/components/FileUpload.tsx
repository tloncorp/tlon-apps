import React, { useCallback, ChangeEvent, useEffect } from 'react';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { dateToDa, deSig } from '@urbit/api';
import { useFileStore, useS3Creds, useS3Config, Upload } from '@/state/storage';

interface UploadInput {
  multiple?: boolean;
}

export default function UploadInput(props: UploadInput) {
  const { multiple } = props;
  const { files, createClient, ...fs } = useFileStore();
  const s3creds = useS3Creds();
  const s3config = useS3Config();

  useEffect(() => {
    const connect = async () => {
      const client = createClient(s3creds);
      return client;
    };
    connect()
      .then(() => fs.setStatus('success'))
      .catch((error: unknown) => {
        console.error(error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createClient, s3creds]);

  const uploadFile = useCallback(
    async (upload: Upload, idx: number) => {
      const timestamp = deSig(dateToDa(new Date()));
      const { file } = upload;
      if (fs.client) {
        fs.setFileStatus([idx, 'loading']);
        const uploadData = await fs.client
          .send(
            new PutObjectCommand({
              Bucket: s3config.currentBucket,
              Key: `${timestamp}-${file.name}`,
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
      fs.setStatus('error');
      return false;
    },
    [fs, s3config]
  );

  useEffect(() => {
    files.forEach((upload: Upload, idx: number) => {
      uploadFile(upload, idx);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length]);

  const onFiles = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      const newFiles = [...e.target.files].map((file) => ({
        file,
        status: 'initial',
      }));
      fs.setFiles(newFiles);
    },
    [fs]
  );

  return (
    <div>
      {fs.status === 'success' && (
        <>
          <input type="file" multiple={multiple} onChange={(e) => onFiles(e)} />
          {files.map((file: Upload) => (
            <pre key={file.file.name}>
              {file.status}: {file.file.name}
            </pre>
          ))}
        </>
      )}
    </div>
  );
}
