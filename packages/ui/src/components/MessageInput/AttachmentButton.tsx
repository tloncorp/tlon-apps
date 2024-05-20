import {
  MessageAttachments,
  Upload,
  UploadInfo,
} from '@tloncorp/shared/dist/api';

import { Attachment } from '../../assets/icons';
import { IconButton } from '../IconButton';

export default function AttachmentButton({
  uploadInfo,
}: {
  uploadInfo: UploadInfo;
}) {
  return (
    <IconButton onPress={() => {}}>
      <Attachment />
    </IconButton>
  );
}
