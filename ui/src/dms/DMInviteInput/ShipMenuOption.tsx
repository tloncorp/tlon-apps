import React from 'react';
import { components, OptionProps } from 'react-select';
import ob from 'urbit-ob';
import { preSig } from '../../logic/utils';
import Avatar from '../../components/Avatar';
import ShipOption from './ShipOption';

type ShipMenuOptionProps = OptionProps<ShipOption, true>;

const ShipMenuOption = React.forwardRef<
  HTMLDivElement | null,
  ShipMenuOptionProps
>(({ data, ...props }: ShipMenuOptionProps, ref) => {
  const { value, label } = data;
  return (
    // TODO: ref?
    <components.Option
      data={data}
      className="hover:cursor-pointer"
      {...props}
      innerRef={(r) => ref}
    >
      <div className="flex items-center space-x-1">
        {ob.isValidPatp(preSig(value)) ? (
          <Avatar ship={preSig(value)} size="xs" />
        ) : (
          <div className="h-6 w-6 rounded bg-white" />
        )}
        <span className="font-semibold">{preSig(value)}</span>
        {label ? (
          <span className="font-semibold text-gray-300">{label}</span>
        ) : null}
      </div>
    </components.Option>
  );
});

export default ShipMenuOption;
