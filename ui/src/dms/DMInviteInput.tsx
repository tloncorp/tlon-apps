import React, { useCallback } from 'react';
import { useNavigate } from 'react-router';
import ob from 'urbit-ob';
import {
  components,
  ControlProps,
  OptionProps,
  MenuProps,
  MenuListProps,
  InputProps,
  MultiValueRemoveProps,
  MultiValueGenericProps,
  MultiValue,
  ActionMeta,
} from 'react-select';
import CreatableSelect from 'react-select/creatable';
import MagnifyingGlass from '../components/icons/MagnifyingGlass16Icon';
import ExclamationPoint from '../components/icons/ExclamationPoint';
import X16Icon from '../components/icons/X16Icon';
import { preSig } from '../logic/utils';
import Avatar from '../components/Avatar';
import { useContacts } from '../state/contact';
import { useChatState } from '../state/chat';

export interface Option {
  value: string;
  label: string;
}

interface DmInviteInputProps {
  ships: Option[];
  setShips: React.Dispatch<React.SetStateAction<Option[]>>;
  fromMulti?: boolean;
}

function Control({ children, ...props }: ControlProps<Option, true>) {
  return (
    <components.Control
      {...props}
      className="input cursor-text items-center text-gray-800"
    >
      <MagnifyingGlass className="h-6 w-6 text-gray-300" />
      {children}
    </components.Control>
  );
}

function ShipName({ data, ...props }: OptionProps<Option, true>) {
  const { value, label } = data;
  return (
    <components.Option
      data={data}
      className="hover:cursor-pointer hover:bg-gray-50 active:bg-gray-50"
      {...props}
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
}

function NoShipsMessage() {
  return (
    <div className="flex content-center space-x-1 px-2 py-3">
      <ExclamationPoint className="w-[18px] text-gray-300" />
      <span className="italic">This name was not found.</span>
    </div>
  );
}

function AddNonContactShip(value: string) {
  return ob.isValidPatp(preSig(value)) ? null : <NoShipsMessage />;
}

function ShipTagLabelContainer({
  children,
  ...props
}: MultiValueGenericProps<Option, true>) {
  return (
    <components.MultiValueContainer {...props}>
      <div className="flex">{children}</div>
    </components.MultiValueContainer>
  );
}

function ShipTagLabel({ data }: { data: Option }) {
  const { value } = data;
  return (
    <div className="flex h-6 items-center rounded-l bg-gray-100">
      <span className="p-1 font-semibold">{value}</span>
    </div>
  );
}

function ShipTagRemove(props: MultiValueRemoveProps<Option, true>) {
  return (
    <components.MultiValueRemove {...props}>
      <div className="flex h-full items-center rounded-r bg-gray-100 pr-1">
        <X16Icon className="h-4 text-gray-300" />
      </div>
    </components.MultiValueRemove>
  );
}

function ShipDropDownMenu({ children, ...props }: MenuProps<Option, true>) {
  return (
    <components.Menu className="rounded-lg border-2 border-gray-100" {...props}>
      {children}
    </components.Menu>
  );
}

function ShipDropDownMenuList({
  children,
  ...props
}: MenuListProps<Option, true>) {
  return (
    <components.MenuList className="rounded-md bg-white" {...props}>
      {children}
    </components.MenuList>
  );
}

function Input({ children, ...props }: InputProps<Option, true>) {
  return (
    <components.Input className="text-gray-800" {...props}>
      {children}
    </components.Input>
  );
}

export default function DMInviteInput({
  ships,
  setShips,
  fromMulti = false,
}: DmInviteInputProps) {
  const contacts = useContacts();
  const contactNames = Object.keys(contacts);
  const contactOptions = contactNames.map((contact) => ({
    value: contact,
    label: contacts[contact].nickname,
  }));
  const navigate = useNavigate();
  const validShips = ships
    ? ships.every((ship) => ob.isValidPatp(ship.value))
    : false;

  const isMulti = ships.length > 1;
  const createClub = useCallback(
    async () =>
      useChatState.getState().createMultiDm(ships.map((s) => s.value)),
    [ships]
  );

  const onKeyDown = async (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && ships && ships.length > 0 && validShips) {
      if (isMulti || fromMulti) {
        const clubId = await createClub();
        navigate(`/dm/${clubId}`);
      } else {
        navigate(`/dm/${ships[0].value}`);
      }
    }
  };

  const onChange = (
    newValue: MultiValue<Option>,
    actionMeta: ActionMeta<Option>
  ) => {
    if (['create-option', 'remove-value'].includes(actionMeta.action)) {
      const validPatps = newValue.filter((o) =>
        ob.isValidPatp(preSig(o.value))
      );
      setShips(validPatps);
    }
  };

  return (
    <CreatableSelect
      formatCreateLabel={AddNonContactShip}
      autoFocus
      isMulti
      styles={{
        control: (base) => ({}),
        menu: ({ width, borderRadius, ...base }) => ({
          borderWidth: '',
          borderColor: '',
          zIndex: 50,
          backgroundColor: 'inherit',
          ...base,
        }),
        input: (base) => ({
          ...base,
          margin: '',
          color: '',
          paddingTop: '',
          paddingBottom: '',
        }),
        multiValue: (base) => ({
          ...base,
          backgroundColor: '',
          margin: '0 2px',
        }),
        multiValueRemove: (base) => ({
          ...base,
          paddingRight: '',
          paddingLeft: '',
          '&:hover': {
            color: 'inherit',
            backgroundColor: 'inherit',
          },
        }),
        option: (base) => ({
          ...base,
          backgroundColor: '',
          '&:active': {
            backgroundColor: 'inherit',
          },
        }),
        valueContainer: (base) => ({
          ...base,
          padding: '0px 8px',
        }),
      }}
      aria-label="Ships"
      options={contactOptions}
      value={ships}
      onChange={onChange}
      isValidNewOption={(inputValue) =>
        inputValue ? ob.isValidPatp(preSig(inputValue)) : false
      }
      onKeyDown={onKeyDown}
      placeholder="Type a name ie; ~sampel-palnet"
      hideSelectedOptions
      // TODO: create custom filter for sorting potential DM participants.
      // filterOption={createFilter(filterConfig)}
      components={{
        Control,
        Menu: ShipDropDownMenu,
        MenuList: ShipDropDownMenuList,
        Input,
        DropdownIndicator: () => null,
        IndicatorSeparator: () => null,
        ClearIndicator: () => null,
        Option: ShipName,
        NoOptionsMessage: NoShipsMessage,
        MultiValueLabel: ShipTagLabel,
        MultiValueContainer: ShipTagLabelContainer,
        MultiValueRemove: ShipTagRemove,
      }}
    />
  );
}
