import { getAppHref } from '@/logic/utils';
import { useCharge } from '@/state/docket';
import { useNavigate, useParams } from 'react-router';
import Dialog, { DialogContent } from '../Dialog';

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
        containerClass="w-full h-full"
        className="h-full overflow-y-auto bg-transparent p-4"
      >
        <iframe className="h-full w-full rounded-lg bg-white" src={path} />
      </DialogContent>
    </Dialog>
  );
}
