import React, { ReactElement, useCallback, useState, useEffect } from 'react';
import Dialog, { DialogContent } from '@/components/Dialog';
import { useStep } from 'usehooks-ts';
import { useForm, FormProvider } from 'react-hook-form';
import { useDismissNavigate } from '@/logic/routing';
import { NewChannelFormSchema, ChannelVisibility } from '@/types/groups';
import NavigationDots from '@/components/NavigationDots';
import { useParams, useNavigate } from 'react-router';
import { useIsMobile } from '@/logic/useMedia';
import { useGroupState, useRouteGroup } from '@/state/groups';
import NewChannelForm from '@/channels/NewChannel/NewChannelForm';
import { useChatState } from '@/state/chat';
import { useDiaryState } from '@/state/diary';
import { useHeapState } from '@/state/heap/heap';
import { strToSym } from '@/logic/utils';
import NewChannelDetails from './NewChannelDetails';

export default function NewChannelModal() {
  const { section } = useParams<{ section: string }>();
  const [channelVisibility, setChannelVisibility] =
    useState<ChannelVisibility>('open');
  const navigate = useNavigate();
  const dismiss = useDismissNavigate();
  const isMobile = useIsMobile();
  const groupFlag = useRouteGroup();
  const defaultValues: NewChannelFormSchema = {
    type: 'chat',
    zone: 'default',
    added: Date.now(),
    readers: [],
    join: true,
    meta: {
      title: '',
      description: '',
      image: '',
      cover: '',
    },
    privacy: 'public',
  };

  const maxStep = 2;
  const [currentStep, { goToNextStep, goToPrevStep, setStep }] =
    useStep(maxStep);

  const form = useForm<NewChannelFormSchema>({
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

  const watchType = form.watch('type');

  const onSubmit = useCallback(
    async (values: NewChannelFormSchema) => {
      const { privacy, type, ...nextChannel } = values;
      /*
        For now channel names are used as keys for pacts. Therefore we need to
        check if a channel with the same name already exists in the chat store. If it does, we
        need to append a timestamp to the end of the name of the new channel.

        Timestamps are used because they are virtually guaranteed to be unique.

        In the future, we will index channels by their full path (including group name), and this will no
        longer be necessary. That change will require a migration of existing channels.
       */
      const tempChannelName = strToSym(values.meta.title);
      const tempNewChannelFlag = `${window.our}/${tempChannelName}`;
      const existingChannel = () => {
        if (type === 'chat') {
          return useChatState.getState().chats[tempNewChannelFlag];
        }

        if (type === 'diary') {
          return useDiaryState.getState().notes[tempNewChannelFlag];
        }

        if (type === 'heap') {
          return useHeapState.getState().stash[tempNewChannelFlag];
        }

        return false;
      };

      const randomSmallNumber = Math.floor(Math.random() * 100);
      const channelName = existingChannel()
        ? `${tempChannelName}-${randomSmallNumber}`
        : tempChannelName;
      const newChannelFlag = `${window.our}/${channelName}`;
      const newChannelNest = `${type}/${newChannelFlag}`;

      if (privacy === 'secret') {
        nextChannel.readers.push('admin');
      } else {
        nextChannel.readers.splice(nextChannel.readers.indexOf('admin'), 1);
      }

      if (section) {
        nextChannel.zone = section;
      }

      const creator =
        type === 'chat'
          ? useChatState.getState().create
          : type === 'heap'
          ? useHeapState.getState().create
          : useDiaryState.getState().create;

      await creator({
        group: groupFlag,
        name: channelName,
        title: values.meta.title,
        description: values.meta.description,
        readers: values.readers,
        writers: privacy !== 'public' ? ['admin'] : [],
      });

      if (section) {
        await useGroupState
          .getState()
          .addChannelToZone(section, groupFlag, newChannelNest);
      }

      if (values.join === true) {
        await useGroupState
          .getState()
          .setChannelJoin(groupFlag, newChannelNest, true);
      }

      navigate(
        isMobile ? `/groups/${groupFlag}` : `/groups/${groupFlag}/info/channels`
      );
    },
    [section, groupFlag, navigate, isMobile]
  );

  let currentStepComponent: ReactElement;

  switch (currentStep) {
    case 1:
      currentStepComponent = (
        <NewChannelForm
          channelVisibility={channelVisibility}
          setChannelVisibility={setChannelVisibility}
          goToNextStep={goToNextStep}
        />
      );
      break;
    case 2:
      currentStepComponent = (
        <NewChannelDetails
          visibility={channelVisibility}
          channelType={watchType}
          goToPrevStep={goToPrevStep}
          goToNextStep={form.handleSubmit(onSubmit)}
        />
      );
      break;
    default:
      currentStepComponent = <span>An error occurred</span>;
      break;
  }

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  return (
    <Dialog defaultOpen onOpenChange={onOpenChange}>
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
