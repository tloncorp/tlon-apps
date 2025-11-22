import { AppDataContextProvider } from '../../ui';
import AttachmentSheet from '../../ui/components/AttachmentSheet';

export default (
  <AppDataContextProvider contacts={[]}>
    <AttachmentSheet onOpenChange={() => {}} isOpen={true} mediaType="all" />
  </AppDataContextProvider>
);
