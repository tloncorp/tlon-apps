import React, { useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useDismissNavigate } from '@/logic/routing';
import { EditCurioFormSchema } from '@/types/heap';
import { FormProvider, useForm } from 'react-hook-form';
import { useHeapState } from '@/state/heap/heap';
import { useChannelFlag } from '@/hooks';
import { isLinkCurio, linkFromCurioContent } from '@/logic/utils';
import useCurioFromParams from './useCurioFromParams';
import HeapTitleInput from './HeapTitleInput';
import HeapContentInput from './HeapContentInput';

export default function EditCurioForm() {
  const dismiss = useDismissNavigate();
  const chFlag = useChannelFlag();
  const { curio, time } = useCurioFromParams();
  const isLink = curio ? isLinkCurio(curio.heart.content) : false;

  const defaultValues: EditCurioFormSchema = {
    title: curio ? curio.heart.title : '',
    content: curio ? linkFromCurioContent(curio.heart.content) : '',
  };

  const formMethods = useForm<EditCurioFormSchema>({
    defaultValues,
  });
  const { handleSubmit, watch } = formMethods;

  const watchedContent = watch('content');
  const isValidInput = [[], [''], ''].every((v) => v !== watchedContent);

  const onDelete = useCallback(async () => {
    if (!chFlag) {
      return;
    }
    if (!time) {
      return;
    }

    await useHeapState.getState().delCurio(chFlag, time.toString());
    dismiss();
  }, [chFlag, dismiss, time]);

  const onSubmit = useCallback(
    async ({ content, title }: EditCurioFormSchema) => {
      if (!chFlag) {
        return;
      }
      if (!curio) {
        return;
      }

      try {
        await useHeapState
          .getState()
          .editCurio(chFlag, time?.toString() || '', {
            ...curio.heart,
            ...{ 
                title,
                content: typeof(content) === 'string' ? [content] : content 
            }, // TODO
          });
        dismiss();
      } catch (error) {
        console.log(error);
      }
    },
    [chFlag, curio, time, dismiss]
  );

  return (
    <FormProvider {...formMethods}>
      <form className="flex flex-col" onSubmit={handleSubmit(onSubmit)}>
        <div className="sm:w-96">
          <header className="mb-3 flex items-center">
            <h2 className="text-lg font-bold">Edit {isLink ? 'Link' : 'Text'}</h2>
          </header>
        </div>
        <HeapTitleInput />
        <HeapContentInput onSubmit={onSubmit} />

        <footer className="mt-4 flex items-center justify-between space-x-2">
          <div>
            <button
              type="button"
              className="button bg-red-soft text-red"
              onClick={onDelete}
            >
              Delete
            </button>
          </div>
          <div className="ml-auto flex items-center space-x-2">
            <DialogPrimitive.Close asChild>
              <button className="secondary-button ml-auto">Cancel</button>
            </DialogPrimitive.Close>
            <button
              type="submit"
              className="button"
              disabled={!isValidInput || !curio}
            >
              Save
            </button>
          </div>
        </footer>
      </form>
    </FormProvider>
  );
}
