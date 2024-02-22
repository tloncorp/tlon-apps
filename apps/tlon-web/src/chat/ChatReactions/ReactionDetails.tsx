import Dialog from '@/components/Dialog';
import WidgetDrawer from '@/components/WidgetDrawer';
import { useIsMobile } from '@/logic/useMedia';

import ReactionsWidget from './ReactionsWidget';

interface ReactionsDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reactions: Record<string, string>;
}

export default function ReactionDetails({
  open,
  onOpenChange,
  reactions,
}: ReactionsDetailsProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <WidgetDrawer
        title="Reaction Details"
        open={open}
        onOpenChange={onOpenChange}
        className="px-[20px] pt-6"
      >
        <ReactionsWidget reacts={reactions} className="h-[40vh] pb-12 pt-3" />
      </WidgetDrawer>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      containerClass="w-full max-w-md overflow-hidden focus-visible:border-none focus:outline-none"
    >
      <header className="mb-4 flex items-center">
        <h2 className="text-lg font-bold">Reaction Details</h2>
      </header>
      <div className="h-[300px] w-full">
        <ReactionsWidget className="h-full" reacts={reactions} />
      </div>
    </Dialog>
  );
}
