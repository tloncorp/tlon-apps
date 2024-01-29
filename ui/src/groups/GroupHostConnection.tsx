import HostConnection, {
  HostConnectionProps,
} from '@/components/HostConnection';
import { getFlagParts } from '@/logic/utils';
import { useGroupCompatibility } from '@/state/groups';
import { useConnectivityCheck } from '@/state/vitals';

interface GroupHostConnectionProps
  extends Pick<HostConnectionProps, 'className' | 'type'> {
  flag: string;
  hideIfConnected?: boolean;
}

export default function GroupHostConnection({
  flag,
  hideIfConnected = false,
  ...props
}: GroupHostConnectionProps) {
  const host = getFlagParts(flag).ship;
  const { data } = useConnectivityCheck(host);
  const { compatible } = useGroupCompatibility(flag);
  const hasIssue =
    !compatible ||
    (data?.status &&
      'complete' in data.status &&
      data.status.complete !== 'yes');

  if (hideIfConnected && !hasIssue) return null;

  return (
    <HostConnection
      ship={host}
      matched={compatible}
      status={data?.status}
      {...props}
    />
  );
}
