import { useValue } from 'react-cosmos/client';

import RadioGroup from '../RadioGroup';

export default function RadioGroupFixture() {
  const [value, setValue] = useValue<string>('value', { defaultValue: '' });

  return (
    <div>
      <RadioGroup
        value={value}
        setValue={setValue}
        options={[
          { label: 'Option 1', value: '1', ariaLabel: 'Option 1' },
          { label: 'Option 2', value: '2', ariaLabel: 'Option 2' },
          { label: 'Option 3', value: '3', ariaLabel: 'Option 3' },
        ]}
        defaultOption="1"
      />
    </div>
  );
}
