import React, { useCallback } from 'react';
import { intersection } from 'lodash';
import { FormProvider, useForm } from 'react-hook-form';
import { useHeapPerms, useHeapState } from '@/state/heap/heap';
import useNest from '@/logic/useNest';
import { nestToFlag } from '@/logic/utils';
import { useRouteGroup, useVessel } from '@/state/groups';
import { NewCurioFormSchema } from '@/types/heap';
import HeapContentInput from './HeapContentInput';

export default function NewCurioForm() {
  const flag = useRouteGroup();
  const nest = useNest();
  const [, chFlag] = nestToFlag(nest);
  const perms = useHeapPerms(nest);
  const vessel = useVessel(flag, window.our);
  const canWrite =
    perms.writers.length === 0 ||
    intersection(perms.writers, vessel.sects).length !== 0;

  const formMethods = useForm<NewCurioFormSchema>({
    defaultValues: {
      content: '',
    },
  });
  const { handleSubmit, reset } = formMethods;

  const onSubmit = useCallback(
    async ({ content }: NewCurioFormSchema) => {
      await useHeapState.getState().addCurio(chFlag, {
        title: null,
        content: [content],
        author: window.our,
        sent: Date.now(),
        replying: null,
      });

      reset();
    },
    [chFlag, reset]
  );

  if (!canWrite) {
    return null;
  }

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <HeapContentInput onSubmit={onSubmit} submissible={true} />
      </form>
    </FormProvider>
  );
}
