import { Drawer } from 'vaul';
import cn from 'classnames';
import { useSafeAreaInsets } from '@/logic/native';

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
          <div hidden={!title}>
            <h3 className="pl-3 text-lg leading-6">{title}</h3>
          </div>
          <div className="flex h-full flex-col">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
