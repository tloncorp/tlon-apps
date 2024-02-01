import SpinToggle from '@/components/SpinToggle';
import WidgetDrawer from '@/components/WidgetDrawer';
import useWidgets, {
  useHideWidgetMutation,
  useShowWidgetMutation,
} from '@/state/profile/profile';
import { Widget } from '@/state/profile/types';
import { useState } from 'react';

export default function EditPublicProfile({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (change: boolean) => void;
}) {
  const widgets = useWidgets();
  const { mutateAsync: show, isLoading: showLoading } = useShowWidgetMutation();
  const { mutateAsync: hide, isLoading: hideLoading } = useHideWidgetMutation();
  const isLoading = showLoading || hideLoading;
  const [loadingWidget, setLoadingWidget] = useState('');

  const onToggle = async (widget: Widget) => {
    const { name, sourceApp, visible } = widget;
    setLoadingWidget(name);
    if (visible) {
      await hide({ name, sourceApp });
    } else {
      await show({ name, sourceApp });
    }
    setLoadingWidget('');
  };

  return (
    <WidgetDrawer
      open={open}
      onOpenChange={onOpenChange}
      className="h-[50vh] px-10 py-8"
    >
      <h2 className="text-lg font-semibold">Customize Profile</h2>
      <p className="pt-4 leading-5 text-gray-400">
        Your profile can connect to your Urbit in all sorts of ways. It's your
        own personal space, make it cozy.
      </p>

      <h3 className="mb-2 pt-8 text-gray-400">Available Widgets</h3>
      <div className=" overflow-scroll">
        {widgets.map((widget) => {
          const { name, sourceApp, description, visible } = widget;
          return (
            <div
              key={widget.id}
              className="flex items-center justify-start py-4"
              onClick={() => onToggle(widget)}
            >
              <SpinToggle
                enabled={visible}
                loading={isLoading && loadingWidget === widget.name}
              />
              <div className="ml-4">
                <h4 className="pb-1 font-semibold">{name}</h4>
                <p className="text-sm text-gray-400">{description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetDrawer>
  );
}
