import React, { useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useDismissNavigate } from '@/logic/routing';
import { CurioFormSchema } from '@/types/heap';
import { useForm } from 'react-hook-form';
import { useHeapState } from '@/state/heap/heap';
import { useChannelFlag } from '@/hooks';
import useCurioFromParams from './useCurioFromParams';

export default function EditCurioForm() {
  const dismiss = useDismissNavigate();
  const chFlag = useChannelFlag();
  const { curio, time } = useCurioFromParams();

  const defaultValues: CurioFormSchema = {
    title: curio ? curio.heart.title : '',
    content: curio ? curio.heart.content : [],
  };

  const { formState, handleSubmit, register, watch } = useForm<CurioFormSchema>(
    {
      defaultValues,
    }
  );

  // TODO: ensure valid input
  // const watchedContent = watch('content');
  // const isValidInput = watchedContent && watchedContent

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
    async (values: CurioFormSchema) => {
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
            ...values,
          });
        dismiss();
      } catch (error) {
        console.log(error);
      }
    },
    [chFlag, curio, time, dismiss]
  );

  return (
    <form className="flex flex-col" onSubmit={handleSubmit(onSubmit)}>
      <div className="sm:w-96">
        <header className="mb-3 flex items-center">
          <h2 className="text-lg font-bold">Edit Item</h2>
        </header>
      </div>
      <label className="mb-3 font-semibold">
        Item Name
        <input
          // @ts-expect-error Dismiss the circular reference warning
          {...register('title')}
          className="input my-2 block w-full p-1"
          type="text"
        />
      </label>
      <label className="mb-3 font-semibold">
        Item Content
        <input
          {...register('content')}
          className="input my-2 block w-full p-1"
          type="text"
        />
      </label>

      <footer className="mt-4 flex items-center justify-between space-x-2">
        <div>
          <button
            type="button"
            className="button red-text-button"
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
            disabled={!formState.isDirty}
          >
            Done
          </button>
        </div>
      </footer>
    </form>
  );
}
