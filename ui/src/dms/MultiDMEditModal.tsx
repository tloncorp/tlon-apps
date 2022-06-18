import React from "react";
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import Dialog, {DialogContent} from '../components/Dialog';
import MultiDMInfoForm from "../components/MultiDMInfoForm/MultiDMInfoForm";

interface MultiDMInfoSchema {
  name: string;
  color: string;
}

export default function MultiDMEditModal() {

  const defaultValues: MultiDMInfoSchema = {
    name: 'Pain Gang',
    color: '#000000'
  };

  const {handleSubmit, register} = useForm<MultiDMInfoSchema>({defaultValues});
  return(
    <Dialog defaultOpen>
     <DialogContent showClose className="sm:max-w-lg">
       <div className="sm:w-96">
       <header className="flex items-center ">
              <div className="text-xl font-bold">
                Edit Chat Info
              </div>
      </header>
       </div>
     

      <MultiDMInfoForm register={register} />
     </DialogContent>
    </Dialog>
  );
}