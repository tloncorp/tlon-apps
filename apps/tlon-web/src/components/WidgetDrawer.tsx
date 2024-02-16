import { useSafeAreaInsets } from '@/logic/native';
import cn from 'classnames';
import { Drawer } from 'vaul';

function Grabber() {
  return (
    <div className="my-3 flex w-full justify-center">
      <div className="h-[5px] w-[32px] rounded-[100px] bg-gray-100" />
    </div>
  );
}

interface WidgetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  withGrabber?: boolean;
}

export default function WidgetDrawer({
  open,
  onOpenChange,
  title,
  children,
  className,
  withGrabber = false,
}: WidgetSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[49] bg-black/20" />
        <Drawer.Content
          className={cn(
            'fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-[32px] bg-white outline-none',
            className
          )}
          style={{
            marginBottom: open ? insets.bottom : undefined,
            marginTop: open ? insets.top : undefined,
          }}
        >
          {withGrabber && <Grabber />}
          <div hidden={!title}>
            <h3 className="pl-3 text-lg leading-6">{title}</h3>
          </div>
          <div className="flex h-full flex-col">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
