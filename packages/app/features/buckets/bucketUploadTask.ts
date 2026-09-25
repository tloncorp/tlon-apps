import type { CreateBucketUploadTask } from './bucketUploadTask.types';

export const createBucketUploadTask: CreateBucketUploadTask = (
  uploadUrl,
  candidate,
  headers,
  onProgress
) => {
  let request: XMLHttpRequest | null = null;
  const abortController = new AbortController();

  const upload = (async () => {
    const body =
      candidate.file ??
      (candidate.uri
        ? await fetch(candidate.uri, { signal: abortController.signal }).then(
            (response) => {
              if (!response.ok) {
                throw new Error(`Could not read file (${response.status})`);
              }
              return response.blob();
            }
          )
        : null);

    if (!body) {
      throw new Error('This file does not have an upload source');
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      request = xhr;
      xhr.open('PUT', uploadUrl);
      Object.entries(headers).forEach(([name, value]) => {
        if (name.toLowerCase() === 'content-length') return;
        xhr.setRequestHeader(name, value);
      });
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onerror = () => reject(new Error('Object upload failed'));
      xhr.onabort = () => reject(new Error('Upload cancelled'));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve();
        } else {
          reject(new Error(`Object upload failed (${xhr.status})`));
        }
      };
      xhr.send(body);
    });
  })();

  return {
    upload,
    cancel: async () => {
      abortController.abort();
      request?.abort();
    },
  };
};
