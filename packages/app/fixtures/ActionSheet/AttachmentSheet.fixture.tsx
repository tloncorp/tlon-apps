import { AppDataContextProvider } from '../../ui';
import AttachmentSheet from '../../ui/src/components/AttachmentSheet';

export default (
  <AppDataContextProvider contacts={[]}>
    <AttachmentSheet
      onAttachmentsSet={() => {}}
      onOpenChange={() => {}}
      isOpen={true}
    />
  </AppDataContextProvider>
);
