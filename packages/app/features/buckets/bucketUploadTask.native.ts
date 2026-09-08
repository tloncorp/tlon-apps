import * as FileSystem from 'expo-file-system/legacy';

import type { CreateBucketUploadTask } from './bucketUploadTask.types';

export const createBucketUploadTask: CreateBucketUploadTask = (
  uploadUrl,
  candidate,
  headers,
  onProgress
) => {
  if (!candidate.uri) {
    return {
      cancel: async () => {},
      upload: Promise.reject(
        new Error('This file does not have a local upload URI')
      ),
    };
  }

  const task = FileSystem.createUploadTask(
    uploadUrl,
    candidate.uri,
    {
      headers,
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    },
    ({ totalBytesExpectedToSend, totalBytesSent }) => {
      if (totalBytesExpectedToSend > 0) {
        onProgress(
          Math.round((totalBytesSent / totalBytesExpectedToSend) * 100)
        );
      }
    }
  );

  return {
    cancel: () => task.cancelAsync(),
    upload: task.uploadAsync().then((response) => {
      if (!response) {
        throw new Error('Object upload was cancelled');
      }
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Object upload failed (${response.status})`);
      }
      onProgress(100);
    }),
  };
};
