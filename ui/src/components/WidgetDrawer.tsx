import { Drawer } from 'vaul';
import cn from 'classnames';

interface WidgetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function WidgetDrawer({
  open,
  onOpenChange,
  title,
  children,
  className,
}: WidgetSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[49] bg-black/20" />
        <Drawer.Content
          className={cn(
            'fixed bottom-0 left-0 right-0 z-50 flex w-full flex-col rounded-t-[32px] bg-white',
            className
          )}
        >
          <div hidden={!title}>
            <h3 className="pl-3 text-lg leading-6">{title}</h3>
          </div>
          <div>{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
