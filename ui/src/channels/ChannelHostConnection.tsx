import HostConnection, {
  HostConnectionProps,
} from '@/components/HostConnection';
import { useChannelCompatibility } from '@/logic/channel';
import { nestToFlag, getFlagParts } from '@/logic/utils';
import { useConnectivityCheck } from '@/state/vitals';

interface ChannelHostConnectionProps
  extends Pick<HostConnectionProps, 'className' | 'type'> {
  nest: string;
}

export default function ChannelHostConnection({
  nest,
  ...props
}: ChannelHostConnectionProps) {
  const [, flag] = nestToFlag(nest);
  const host = getFlagParts(flag).ship;
  const { data } = useConnectivityCheck(host);
  const { compatible } = useChannelCompatibility(nest);

  return (
    <HostConnection
      ship={host}
      status={data?.status}
      matched={compatible}
      {...props}
    />
  );
}
