import { getAppHref } from '@/logic/utils';
import { useCharge } from '@/state/docket';
import { useNavigate, useParams } from 'react-router';
import Dialog, { DialogContent } from '../Dialog';
import ArrowEIcon16 from '../icons/ArrowEIcon16';
import ArrowNWIcon from '../icons/ArrowNWIcon';
import OpenSmallIcon from '../icons/OpenSmallIcon';

export default function AppModal() {
  const navigate = useNavigate();
  const { desk } = useParams<{ desk: string }>();
  const { href } = useCharge(desk || '');
  const path = getAppHref(href);

  const onOpenChange = (open: boolean) => {
    if (!open) {
      navigate(-1);
    }
  };

  return (
    <Dialog defaultOpen modal onOpenChange={onOpenChange}>
      <DialogContent
        containerClass="w-full h-full pt-0"
        className="mt-7 h-full w-full overflow-y-auto bg-transparent"
        appModal
      >
        <iframe className="mt-3 h-3/4 w-full rounded-lg bg-white" src={path} />
        <a
          href={path}
          className="small-button absolute -top-3 right-6 m-4 h-6 w-6 cursor-pointer bg-white p-1 text-gray-600 hover:bg-gray-50"
          title="Open in new tab"
          target="_blank"
          rel="noreferrer"
        >
          <OpenSmallIcon className="h-3 w-3" />
        </a>
      </DialogContent>
    </Dialog>
  );
}
