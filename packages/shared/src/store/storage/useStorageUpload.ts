// import {
//   CreateMultipartUploadCommand,
//   PutObjectCommand,
// } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// import { useCallback, useMemo } from 'react';

// import { CustomStorageConfig, useStorageType } from './upload';
// import { getMemexUploadUrl, getUploadObjectKey } from './utils';

// export type UploadInterface = {
//   canUpload: boolean;
//   isHosted: boolean;
//   getUploadUrl: (file: {
//     fileName: string;
//     type: string;
//     size: number;
//   }) => Promise<string>;
// };

// export function useUploadInterface(currentUserId: string): UploadInterface {
//   const storage = useStorageType();

//   const getUploadUrl = useCallback(
//     async (file: { fileName: string; type: string; size: number }) => {
//       if (storage.type === 'hosted') {
//         return getMemexUploadUrl(currentUserId, file.fileName);
//       }

//       if (storage.type === 'custom') {
//         console.log('STORAGE: getting custom upload url');
//         const key = getUploadObjectKey(currentUserId, file.fileName);
//         const signedUrl = await getCustomUploadUrl({
//           key,
//           file,
//           config: storage.config,
//         });
//         console.log(`STORAGE: got custom upload url`, signedUrl);
//         return signedUrl;
//       }

//       return '';
//     },
//     [currentUserId, storage]
//   );

//   const uploadInterface = useMemo(
//     () => ({
//       canUpload: storage.type !== 'unavailable',
//       isHosted: storage.type === 'hosted',
//       getUploadUrl,
//     }),
//     [getUploadUrl, storage.type]
//   );

//   return uploadInterface;
// }

// async function getCustomUploadUrl({
//   config,
//   key,
//   file,
// }: {
//   config: CustomStorageConfig;
//   key: string;
//   file: { fileName: string; type: string; size: number };
// }) {
//   console.log(
//     `putting object to bucket ${config.bucket} with ${file.type} ${file.size}`
//   );
// const command = new PutObjectCommand({
//   Bucket: config.bucket,
//   Key: key,
//   ContentType: file.type,
//   ContentLength: file.size,
//   // ACL: 'public-read',
// });

// const signedUrl = await getSignedUrl(config.client, command);
//   return signedUrl;
// }
