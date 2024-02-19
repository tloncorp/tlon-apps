import { useLocation, useNavigate, useParams } from 'react-router';

import { getAppHref } from '@/logic/utils';
import { useCharge } from '@/state/docket';

import Dialog, { DialogContent } from '../Dialog';
import ArrowNEIcon from '../icons/ArrowNEIcon';

export default function AppModal() {
  const navigate = useNavigate();
  const {
    state: { backgroundLocation },
  } = useLocation();
  const { desk } = useParams<{ desk: string }>();
  const { href, title, image, color } = useCharge(desk || '');
  const path = getAppHref(href);

  const onOpenChange = (open: boolean) => {
    if (!open) {
      navigate(backgroundLocation);
    }
  };

  return (
    <Dialog
      defaultOpen
      modal
      onOpenChange={onOpenChange}
      containerClass="w-full h-full rounded-xl pt-0"
      className="mt-7 h-5/6 w-full bg-white px-0 pb-0"
      close="app"
    >
      <iframe
        className="mt-6 h-full w-full overflow-y-auto rounded-b-xl border-t-2 border-gray-50 bg-[#fff]"
        src={path}
      />
      <div className="absolute -top-2 left-0 m-4 flex items-center justify-center space-x-2">
        {(image || color) && (
          <div
            className="h-8 w-8 items-center justify-center rounded"
            style={{
              backgroundColor: color,
              backgroundImage: `url(${image})`,
              backgroundSize: 'cover',
            }}
          />
        )}
        {title && <span className="font-semibold text-black">{title}</span>}
      </div>
      <div className="absolute right-10 top-1 flex cursor-pointer items-center justify-center rounded-md bg-white text-gray-600 hover:bg-gray-50">
        <a href={path} title="Open in new tab" target="_blank" rel="noreferrer">
          <ArrowNEIcon className="h-8 w-8" />
        </a>
      </div>
    </Dialog>
  );
}
