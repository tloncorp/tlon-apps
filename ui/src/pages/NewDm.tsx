import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import ob from 'urbit-ob';
import Select, {
  components,
  ControlProps,
  OptionProps,
  MultiValue,
  createFilter,
} from 'react-select';
import ChatInput from '../chat/ChatInput/ChatInput';
import Layout from '../components/layout/Layout';
import MagnifyingGlass from '../components/icons/MagnifyingGlass';
import { useContacts } from '../state/contact';
import Avatar from '../components/Avatar';
import ExclamationPoint from '../components/icons/ExclamationPoint';

interface Option {
  value: string;
  label: string;
}

function MagnifyingGlassControl({
  children,
  ...props
}: ControlProps<Option, true>) {
  return (
    <components.Control {...props}>
      <MagnifyingGlass className="ml-2 h-3 text-gray-300" />
      {children}
    </components.Control>
  );
}

function SigOption({ data, ...props }: OptionProps<Option, true>) {
  const { value, label } = data;
  return (
    <components.Option data={data} {...props}>
      <div className="flex items-center space-x-1">
        <Avatar ship={value} size="xs" />
        <span className="font-semibold">{value}</span>
        {label ? (
          <span className="font-semibold text-gray-300">{label}</span>
        ) : null}
      </div>
    </components.Option>
  );
}

function NoShipsMessage() {
  return (
    <div className="flex content-center space-x-1 px-2 py-3">
      <ExclamationPoint className="w-[18px] text-gray-300" />
      <span className="italic">This name was not found.</span>
    </div>
  );
}

function ShipTagLabel({ data }: { data: Option }) {
  const { value } = data;
  return (
    <div className="flex items-center space-x-1">
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export default function NewDM() {
  const [ship, setShip] = useState<Option | undefined>();
  const contacts = useContacts();
  const contactNames = Object.keys(contacts);
  const contactOptions = contactNames.map((contact) => ({
    value: contact,
    label: contacts[contact].nickname,
  }));
  const navigate = useNavigate();
  const validShip = ship ? ob.isValidPatp(ship.value) : false;
  const onChange = (inputValue: MultiValue<Option>) => {
    if (inputValue) {
      // We can only set one ship for the time being.
      // For now we'll just take the first ship.
      setShip(inputValue[0]);
    }
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !!ship && validShip) {
      navigate(`/dm/${ship.value}`);
    }
  };

  // const filterConfig = {
  // ignoreCase: true,
  // ignoreAccents: true,
  // trim: true,
  // matchFrom: 'any',
  // };

  return (
    <Layout
      className="flex-1"
      footer={
        <div className="border-t-2 border-black/10 p-4">
          <ChatInput whom={ship ? ship.value : ''} showReply sendDisabled={!validShip} newDm />
        </div>
      }
    >
      <div className="w-full p-4">
        <Select
          autoFocus
          isMulti
          styles={{
            control: (base) => ({
              ...base,
              borderRadius: '8px',
              borderWidth: '2px',
            }),
            menu: ({ width, ...base }) => ({
              ...base,
              borderRadius: '8px',
              borderWidth: '2px',
            }),
          }}
          aria-label="Ships"
          options={contactOptions}
          value={ship}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder="Type a name ie; ~sampel-palnet"
          hideSelectedOptions
          // TODO: create custom filter for sorting potential DM participants.
          // filterOption={createFilter(filterConfig)}
          components={{
            Control: MagnifyingGlassControl,
            DropdownIndicator: () => null,
            IndicatorSeparator: () => null,
            Option: SigOption,
            NoOptionsMessage: NoShipsMessage,
            MultiValueLabel: ShipTagLabel,
          }}
        />
      </div>
    </Layout>
  );
}
