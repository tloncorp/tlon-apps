import { Upload } from '@tloncorp/shared/dist/api';

import { Attachment } from '../../assets/icons';
import { IconButton } from '../IconButton';

export default function AttachmentButton({
  setImage,
  paddingBottom,
}: {
  setImage: (uri: string) => void;
  uploadedImage?: Upload | null;
  paddingBottom: number;
}) {
  return (
    <IconButton onPress={() => {}}>
      <Attachment />
    </IconButton>
  );
}
