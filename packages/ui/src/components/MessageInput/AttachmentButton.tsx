import {
  MessageAttachments,
  Upload,
  UploadInfo,
} from '@tloncorp/shared/dist/api';

import { Attachment } from '../../assets/icons';
import { IconButton } from '../IconButton';

export default function AttachmentButton({
  setShouldBlur,
}: {
  setShouldBlur: (shouldBlur: boolean) => void;
}) {
  return (
    <IconButton onPress={() => {}}>
      <Attachment />
    </IconButton>
  );
}
