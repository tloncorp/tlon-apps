import { TooltipProvider } from '@radix-ui/react-tooltip';
import { QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren } from 'react';

import queryClient from './queryClient';
import { useScheduler } from './state/scheduler';

/**
 * This component wraps all Cosmos fixtures. It supplies the necessary providers
 * and wraps displayed components with some basic styling.
 */
function AppDecorator({ children }: PropsWithChildren) {
  useScheduler();

  return (
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <div className="h-full w-full overflow-auto">
          <div className="p-10">{children}</div>
        </div>
      </QueryClientProvider>
    </TooltipProvider>
  );
}

export default AppDecorator;
