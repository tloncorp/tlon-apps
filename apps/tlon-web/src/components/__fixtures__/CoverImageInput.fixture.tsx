import CoverImageInput from '@/components/CoverImageInput';
import { useSelect } from 'react-cosmos/client';
import { FormProvider, useForm } from 'react-hook-form';

export default function CoverImageInputFixture() {
  const form = useForm({});
  const [url] = useSelect('URL', {
    options: ['', 'https://urbit.org/assets/images/landscape.png'],
  });

  return (
    <FormProvider {...form}>
      <CoverImageInput className="w-full" url={url} />
    </FormProvider>
  );
}
