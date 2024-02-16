import Dialog from '@/components/Dialog';
import SpinToggle from '@/components/SpinToggle';
import WidgetDrawer from '@/components/WidgetDrawer';
import { useIsMobile } from '@/logic/useMedia';
import { useCharges } from '@/state/docket';
import useWidgets, {
  refreshAvailableWidgets,
  useHideWidgetMutation,
  useShowWidgetMutation,
} from '@/state/profile/profile';
import { Widget } from '@/state/profile/types';
import cn from 'classnames';
import { useEffect, useState } from 'react';

export default function EditPublicProfile({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (change: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const widgets = useWidgets();
  const charges = useCharges();
  const { mutateAsync: show, isLoading: showLoading } = useShowWidgetMutation();
  const { mutateAsync: hide, isLoading: hideLoading } = useHideWidgetMutation();
  const isLoading = showLoading || hideLoading;
  const [loadingWidget, setLoadingWidget] = useState('');

  // no subscription for available widgets, so we refresh data
  // manually on mount and open
  useEffect(() => {
    refreshAvailableWidgets();
  }, []);

  useEffect(() => {
    if (open) {
      refreshAvailableWidgets();
    }
  }, [open]);

  const onToggle = async (widget: Widget) => {
    const { id, visible } = widget;
    setLoadingWidget(id);
    if (visible) {
      await hide({ id });
    } else {
      await show({ id });
    }
    setLoadingWidget('');
  };

  return (
    <Container open={open} onOpenChange={onOpenChange}>
      <h2 className="text-lg font-semibold">Customize Profile</h2>
      <p className="pt-4 leading-5 text-gray-400">
        Your profile can connect to your Urbit in all sorts of ways. It's your
        own personal space, make it cozy.
      </p>

      <h3 className="mb-2 pt-8 text-gray-400">Available Widgets</h3>
      <div className={cn('overflow-scroll', !isMobile && 'h-[200px]')}>
        {widgets.map((widget) => {
          const { name, sourceApp, visible } = widget;
          return (
            <div
              key={widget.id}
              className="flex items-center justify-start py-4"
              onClick={() => onToggle(widget)}
            >
              <SpinToggle
                enabled={visible}
                loading={isLoading && loadingWidget === widget.id}
              />
              <div className="ml-4">
                <span className="text-sm text-gray-400">
                  {charges[sourceApp]?.title || sourceApp}
                </span>
                <h4 className="pb-1 text-lg">{name}</h4>
              </div>
            </div>
          );
        })}
      </div>
    </Container>
  );
}

function Container({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (newOpen: boolean) => void;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  return isMobile ? (
    <WidgetDrawer
      open={open}
      onOpenChange={onOpenChange}
      className="h-[50vh] px-10 py-8"
    >
      {children}
    </WidgetDrawer>
  ) : (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      containerClass="w-full sm:max-w-lg h-[500px] overflow-hidden focus-visible:border-none focus:outline-none"
    >
      {children}
    </Dialog>
  );
}
