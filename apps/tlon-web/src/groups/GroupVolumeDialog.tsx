import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import { Helmet } from 'react-helmet';

import Dialog from '@/components/Dialog';
import VolumeSetting from '@/components/VolumeSetting';
import { useDismissNavigate } from '@/logic/routing';
import { useGroup, useRouteGroup } from '@/state/groups';

import GroupSummary from './GroupSummary';

export default function GroupVolumeDialog({ title }: ViewProps) {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const meta = group?.meta;
  const dismiss = useDismissNavigate();

  if (!meta) {
    return null;
  }

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
      className="m-0 flex h-[90vh] w-[90vw]  flex-col justify-center bg-transparent p-0 sm:h-[75vh] sm:max-h-[800px] sm:w-[75vw] sm:max-w-[800px]"
    >
      <Helmet>
        <title>
          {group?.meta
            ? `Notification settings for ${group.meta.title} ${title}`
            : title}
        </title>
      </Helmet>
      <div className="card mb-6">
        <GroupSummary flag={flag} preview={{ ...group, flag }} />
        {meta.description && (
          <p className="mt-4 w-full leading-5">{meta.description}</p>
        )}
      </div>
      <div className="card mb-6 space-y-6">
        <div className="flex flex-col space-y-1">
          <span className="text-lg text-gray-800">Notification Settings</span>
        </div>
        <VolumeSetting source={{ group: flag }} />
      </div>
    </Dialog>
  );
}
