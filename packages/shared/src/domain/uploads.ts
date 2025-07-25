export type UploadStateError = { status: 'error'; errorMessage: string };
export type UploadStateUploading = { status: 'uploading'; localUri: string };
export type UploadStateSuccess = { status: 'success'; remoteUri: string };

export type UploadState =
  | UploadStateError
  | UploadStateUploading
  | UploadStateSuccess;
