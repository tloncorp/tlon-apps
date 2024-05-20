import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import { Helmet } from 'react-helmet';
import { useParams } from 'react-router';

import Dialog from '@/components/Dialog';
import VolumeSetting from '@/components/VolumeSetting';
import { useDismissNavigate } from '@/logic/routing';
import { useGroupChannel, useRouteGroup } from '@/state/groups';

export default function ChannelVolumeDialog({ title }: ViewProps) {
  const { chType, chShip, chName } = useParams<{
    chType: string;
    chShip: string;
    chName: string;
  }>();
  const flag = useRouteGroup();
  const dismiss = useDismissNavigate();
  const nest = `${chType}/${chShip}/${chName}`;
  const channel = useGroupChannel(flag, nest);

  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
    }
  };

  return (
    <Dialog
      defaultOpen
      modal
      onOpenChange={onOpenChange}
      className="m-0 flex h-[90vh] w-[90vw] flex-col p-0 sm:h-auto sm:max-h-[800px] sm:w-[75vw] sm:max-w-[800px]"
    >
      <Helmet>
        <title>
          {channel?.meta
            ? `Notifcation settings for ${channel.meta.title} ${title}`
            : title}
        </title>
      </Helmet>
      <div className="card mb-6 space-y-6">
        <div className="flex flex-col space-y-1">
          <span className="text-lg text-gray-800">Notification Settings</span>
          <span className="text-sm text-gray-500">
            {channel?.meta ? `${channel.meta.title}` : null}
          </span>
        </div>
        <VolumeSetting source={{ channel: { nest, group: flag } }} />
      </div>
    </Dialog>
  );
}
