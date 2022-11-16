import React, { ReactElement, useCallback, useState, useEffect } from 'react';
import Dialog, { DialogContent } from '@/components/Dialog';
import {
  ChannelFormSchema,
  ChannelType,
  GroupChannel,
  ChannelVisibility,
} from '@/types/groups';
import { useStep } from 'usehooks-ts';
import { useForm, FormProvider } from 'react-hook-form';
import { useDismissNavigate } from '@/logic/routing';
import NavigationDots from '@/components/NavigationDots';
import { useGroupState, useRouteGroup } from '@/state/groups';
import NewChannelForm from '@/channels/NewChannel/NewChannelForm';
import { useChatState } from '@/state/chat';
import { useDiaryState } from '@/state/diary';
import { useHeapState } from '@/state/heap/heap';
import { getPrivacyFromChannel, nestToFlag } from '@/logic/utils';
import NewChannelDetails from '@/channels/NewChannel/NewChannelDetails';

interface EditChannelModalProps {
  nest: string;
  channel: GroupChannel;
  presetSection?: string;
  editIsOpen: boolean;
  setEditIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function EditChannelModal({
  nest,
  channel,
  editIsOpen,
  presetSection,
  setEditIsOpen,
}: EditChannelModalProps) {
  const groupFlag = useRouteGroup();
  const [app, channelFlag] = nestToFlag(nest);
  const [channelVisibility, setChannelVisibility] =
    useState<ChannelVisibility>('open');
  const defaultValues: ChannelFormSchema = {
    zone: channel.zone || 'default',
    added: channel.added || Date.now(),
    readers: channel.readers || [],
    join: channel.join || false,
    meta: channel.meta || {
      title: '',
      description: '',
      image: '',
      color: '',
    },
    privacy: getPrivacyFromChannel(channel),
  };

  const maxStep = 2;
  const [currentStep, { goToNextStep, goToPrevStep, setStep }] =
    useStep(maxStep);

  const form = useForm<ChannelFormSchema>({
    defaultValues,
    mode: 'onChange',
  });

  useEffect(() => {
    if (channelVisibility === 'open') {
      form.setValue('privacy', 'public');
    } else {
      form.setValue('privacy', 'read-only');
    }
  }, [channelVisibility, form]);

  const onSubmit = useCallback(
    async (values: ChannelFormSchema) => {
      const { privacy, ...nextChannel } = values;

      if (privacy === 'secret') {
        nextChannel.readers.push('admin');
      } else {
        nextChannel.readers.splice(nextChannel.readers.indexOf('admin'), 1);
      }

      if (presetSection) {
        nextChannel.zone = presetSection;
      }

      await useGroupState.getState().editChannel(groupFlag, nest, nextChannel);

      const chState =
        app === 'chat'
          ? useChatState.getState()
          : app === 'heap'
          ? useHeapState.getState()
          : useDiaryState.getState();

      if (privacy !== 'public') {
        chState.addSects(channelFlag, ['admin']);
      } else {
        chState.delSects(channelFlag, ['admin']);
      }

      setEditIsOpen(false);
    },
    [app, channelFlag, groupFlag, nest, setEditIsOpen, presetSection]
  );

  let currentStepComponent: ReactElement;

  switch (currentStep) {
    case 1:
      currentStepComponent = (
        <NewChannelForm
          edit
          channelVisibility={channelVisibility}
          setChannelVisibility={setChannelVisibility}
          goToNextStep={goToNextStep}
        />
      );
      break;
    case 2:
      currentStepComponent = (
        <NewChannelDetails
          edit
          visibility={channelVisibility}
          channelType={app as ChannelType}
          goToPrevStep={goToPrevStep}
          goToNextStep={form.handleSubmit(onSubmit)}
        />
      );
      break;
    default:
      currentStepComponent = <span>An error occurred</span>;
      break;
  }

  return (
    <Dialog open={editIsOpen} onOpenChange={setEditIsOpen}>
      <DialogContent
        containerClass="w-full sm:max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <FormProvider {...form}>{currentStepComponent}</FormProvider>
        <div className="flex flex-col items-center pt-4">
          <NavigationDots
            maxStep={maxStep}
            currentStep={currentStep}
            setStep={(step) => setStep(step + 1)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
