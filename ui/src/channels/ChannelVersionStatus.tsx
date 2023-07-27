import ExclamationPoint from '@/components/icons/ExclamationPoint';
import { Saga } from '@/types/groups';
import * as Tooltip from '@radix-ui/react-tooltip';

interface ChannelVersionStatusProps {
  saga: Saga | null;
}

export default function ChannelVersionStatus({
  saga,
}: ChannelVersionStatusProps) {
  if (!saga || 'synced' in saga) {
    return null;
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <div>
          <ExclamationPoint className="h-6 w-6 text-yellow" />
        </div>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          asChild
          side="bottom"
          sideOffset={5}
          align="end"
          alignOffset={-10}
        >
          <div className="z-50">
            <div className="z-[100] w-fit max-w-[320px] cursor-none space-y-2 rounded bg-gray-400 px-4 py-2 font-semibold text-white">
              {/* The saga is about the host, not us so if the host is behind that means we're ahead */}
              <p>
                You&apos;re urbit is {'behind' in saga ? 'ahead of' : 'behind'}{' '}
                the channel's host.
              </p>
              <p>
                You will not receive updates or be able to post until you are in
                sync.
              </p>
            </div>
            <Tooltip.Arrow asChild>
              <svg
                width="17"
                height="8"
                viewBox="0 0 17 8"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M16.5 0L0.5 0L7.08579 6.58579C7.86684 7.36684 9.13316 7.36684 9.91421 6.58579L16.5 0Z"
                  // fill="#999999"
                  className="fill-gray-400"
                />
              </svg>
            </Tooltip.Arrow>
          </div>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
