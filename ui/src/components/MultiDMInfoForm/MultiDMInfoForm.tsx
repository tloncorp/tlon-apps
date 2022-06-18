import React from 'react';
import { UseFormRegister } from 'react-hook-form';
import * as DialogPrimitive from '@radix-ui/react-dialog';

interface MultiDMInfoSchema {
  name: string;
  color: string;
}

export default function MultiDMInfoForm(props: {
  register: UseFormRegister<MultiDMInfoSchema>;
}) {
  const { register } = props;

  return (
    <form onSubmit={() => console.log("submitted!")} className="flex flex-col">
  <div className="mb-4 flex flex-col">
  <div className="py-4">
    <label htmlFor="title" className='w-full font-bold'>Color</label>
    <input {...register('color')} className="input mt-4 block w-full p-1" type="text" />
  </div>
  <div className="py-4">
    <label htmlFor="description" className=' w-full font-bold'>DM Name</label>
    <input
      {...register('name')}
      className="input mt-4 block w-full p-1"
      type="text"
    />
  </div>
</div>
  <footer className='flex items-center space-x-2'>
    <DialogPrimitive.Close asChild>
      <button className="button ml-auto">Cancel</button>
    </DialogPrimitive.Close>
    <DialogPrimitive.Close disabled asChild>
      <button className="button">Done</button>
    </DialogPrimitive.Close>
  </footer>
</form>
  );
}