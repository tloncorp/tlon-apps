import { Upload } from '@tloncorp/shared/dist/urbit';

import { Attachment } from '../../assets/icons';
import { IconButton } from '../IconButton';

export default function AttachmentButton({
  setImage,
}: {
  setImage: (uri: string) => void;
  uploadedImage?: Upload | null;
}) {
  return (
    <IconButton onPress={() => {}}>
      <Attachment />
    </IconButton>
  );
}
