import ShipName from '@/components/ShipName';
import Lock16Icon from '@/components/icons/Lock16Icon';
import Private16Icon from '@/components/icons/Private16Icon';
import { getFlagParts } from '@/logic/utils';
import { GroupPreview } from '@/types/groups';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import GroupAvatar from '@/groups/GroupAvatar';
import Globe16Icon from '@/components/icons/Globe16Icon';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useConnectivityCheck } from '@/state/vitals';
import { useGroup } from '@/state/groups';
import ShipConnection from '@/components/ShipConnection';
import GroupHostConnection from './GroupHostConnection';

export type GroupSummarySize = 'default' | 'small';

interface GroupSummaryProps extends Partial<GroupPreview> {
  flag: string;
  preview: GroupPreview | null;
  size?: GroupSummarySize;
  check?: boolean;
}

export default function GroupSummary({
  flag,
  preview,
  size = 'default',
  check = true,
}: GroupSummaryProps) {
  const { privacy } = useGroupPrivacy(flag);
  const { ship } = getFlagParts(flag);
  const group = useGroup(flag, false);
  const { data } = useConnectivityCheck(ship, { enabled: check });
  const meta = preview?.meta || group?.meta;

  if (!meta) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner /> <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 font-semibold">
      <GroupAvatar
        {...meta}
        className="flex-none"
        size={size === 'default' ? 'h-[72px] w-[72px]' : 'h-12 w-12'}
      />
      <div className="space-y-2">
        <h3>{meta.title || flag}</h3>
        {size === 'default' ? (
          <p className="text-gray-400">
            Hosted by <ShipName name={ship} />
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-gray-600">
          {privacy ? (
            <span className="inline-flex items-center space-x-1 capitalize">
              {privacy === 'public' ? (
                <Globe16Icon className="h-4 w-4" />
              ) : privacy === 'private' ? (
                <Lock16Icon className="h-4 w-4" />
              ) : (
                <Private16Icon className="h-4 w-4" />
              )}
              <span>{privacy}</span>
            </span>
          ) : null}
          {!check ? null : group ? (
            <GroupHostConnection type="combo" flag={flag} />
          ) : (
            <ShipConnection
              type="combo"
              ship={ship}
              status={data?.status}
              agent="channels-server"
              app="channels"
            />
          )}
        </div>
      </div>
    </div>
  );
}
