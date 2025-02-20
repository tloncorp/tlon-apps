import { QueryClientProvider, queryClient } from '@tloncorp/shared';
import { AppDataContextProvider } from '../../ui';
import { CreateChannelSheet } from '../../ui/src/components/ManageChannels/CreateChannelSheet';

import { group } from '../fakeData';

export default (
  <QueryClientProvider client={queryClient}>
    <AppDataContextProvider contacts={[]}>
      <CreateChannelSheet group={group} onOpenChange={() => {}} />
    </AppDataContextProvider>
  </QueryClientProvider>
);
