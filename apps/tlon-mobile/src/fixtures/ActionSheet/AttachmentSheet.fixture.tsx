import { AppDataContextProvider } from '@tloncorp/ui';
import AttachmentSheet from '@tloncorp/ui/src/components/AttachmentSheet';

export default (
  <AppDataContextProvider contacts={[]}>
    <AttachmentSheet
      setImage={() => {}}
      setShowAttachmentSheet={() => {}}
      showAttachmentSheet={true}
    />
  </AppDataContextProvider>
);
