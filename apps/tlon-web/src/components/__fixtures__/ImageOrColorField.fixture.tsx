import { useSelect } from 'react-cosmos/client';
import { FormProvider, useForm } from 'react-hook-form';

import ImageOrColorField from '@/components/ImageOrColorField';

export default function ImageOrColorFieldFixture() {
  const form = useForm({});
  const [state, setState] = useSelect('State', {
    defaultValue: 'color',
    options: ['image', 'color'],
  });

  return (
    <FormProvider {...form}>
      <ImageOrColorField
        state={state}
        setState={setState}
        fieldName={'testField'}
      />
    </FormProvider>
  );
}
