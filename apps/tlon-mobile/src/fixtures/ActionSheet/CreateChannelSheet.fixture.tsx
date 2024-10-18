import { QueryClientProvider, queryClient } from '@tloncorp/shared';
import { AppDataContextProvider } from '@tloncorp/ui';
import { CreateChannelSheet } from '@tloncorp/ui/src/components/ManageChannels/CreateChannelSheet';

import { group } from '../fakeData';

export default (
  <QueryClientProvider client={queryClient}>
    <AppDataContextProvider contacts={[]}>
      <CreateChannelSheet
        group={group}
        onOpenChange={() => {}}
        enableCustomChannels={false}
      />
    </AppDataContextProvider>
  </QueryClientProvider>
);
