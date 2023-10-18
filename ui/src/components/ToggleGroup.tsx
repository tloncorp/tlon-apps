import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import cn from 'classnames';

type ToggleOption = {
  value: string;
  label: string;
  ariaLabel: string;
};

export default function ToggleGroup({
  value,
  setValue,
  options,
  defaultOption,
}: {
  value: string;
  setValue: (val: string) => void;
  options: ToggleOption[];
  defaultOption: string;
}) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn(
        `mx-4 grid grid-cols-${options.length} gap-[2px] rounded-[10px] bg-white font-sans`
      )}
      type="single"
      value={value}
      defaultValue={defaultOption}
      onValueChange={(val: string) => {
        if (val) {
          setValue(val);
        }
      }}
    >
      {options.map((option, index) => (
        <ToggleGroupPrimitive.Item
          value={option.value}
          aria-label={option.ariaLabel}
          className={cn(
            'w-full whitespace-nowrap px-4 py-[7px] text-[17px] leading-[22px]',
            {
              'bg-black text-white': value === option.value,
              'bg-gray-50 text-gray-800': value !== option.value,
              'rounded-l-[10px]': index === 0,
              'rounded-r-[10px]': index === options.length - 1,
            }
          )}
        >
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
