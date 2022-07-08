import React, { useMemo, useRef, useState } from 'react';
import ob from 'urbit-ob';
import fuzzy from 'fuzzy';
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
  GroupBase,
} from 'react-select';
import CreatableSelect from 'react-select/creatable';
import Select from 'react-select/dist/declarations/src/Select';
import MagnifyingGlass from '@/components/icons/MagnifyingGlass16Icon';
import ExclamationPoint from '@/components/icons/ExclamationPoint';
import X16Icon from '@/components/icons/X16Icon';
import { preSig } from '@/logic/utils';
import Avatar from '@/components/Avatar';
import { useMemoizedContacts } from '@/state/contact';
import { MAX_DISPLAYED_OPTIONS } from '@/constants';
import { deSig } from '@urbit/api';

export interface ShipOption {
  value: string;
  label: string;
}

interface ShipSelectorProps {
  ships: ShipOption[];
  setShips: React.Dispatch<React.SetStateAction<ShipOption[]>>;
  onEnter?: (ships: ShipOption[]) => void;
}

function Control({ children, ...props }: ControlProps<ShipOption, true>) {
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

function ShipName({ data, ...props }: OptionProps<ShipOption, true>) {
  const { value, label } = data;
  return (
    <components.Option data={data} className="hover:cursor-pointer" {...props}>
      <div className="flex items-center space-x-1">
        {ob.isValidPatp(preSig(value)) ? (
          <Avatar ship={preSig(value)} size="xs" />
        ) : (
          <div className="h-6 w-6 rounded bg-white" />
        )}
        {label ? (
          <>
            <span className="font-semibold">{label}</span>
            <span className="font-semibold text-gray-300">{preSig(value)}</span>
          </>
        ) : (
          <span className="font-semibold">{preSig(value)}</span>
        )}
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
}: MultiValueGenericProps<ShipOption, true>) {
  return (
    <components.MultiValueContainer {...props}>
      <div className="flex">{children}</div>
    </components.MultiValueContainer>
  );
}

function ShipTagLabel({ data }: { data: ShipOption }) {
  const { value, label } = data;
  return (
    <div className="flex h-6 items-center rounded-l bg-gray-100">
      <span className="p-1 font-semibold">{label || value}</span>
    </div>
  );
}

function ShipTagRemove(props: MultiValueRemoveProps<ShipOption, true>) {
  return (
    <components.MultiValueRemove {...props}>
      <div className="flex h-full items-center rounded-r bg-gray-100 pr-1">
        <X16Icon className="h-4 text-gray-300" />
      </div>
    </components.MultiValueRemove>
  );
}

function ShipDropDownMenu({ children, ...props }: MenuProps<ShipOption, true>) {
  return (
    <components.Menu className="rounded-lg border-2 border-gray-100" {...props}>
      {children}
    </components.Menu>
  );
}

function ShipDropDownMenuList({
  children,
  ...props
}: MenuListProps<ShipOption, true>) {
  return (
    <components.MenuList className="rounded-md bg-white" {...props}>
      {children}
    </components.MenuList>
  );
}

function Input({ children, ...props }: InputProps<ShipOption, true>) {
  return (
    <components.Input className="text-gray-800" {...props}>
      {children}
    </components.Input>
  );
}

export default function ShipSelector({
  ships,
  setShips,
  onEnter,
}: ShipSelectorProps) {
  const selectRef = useRef<Select<
    ShipOption,
    true,
    GroupBase<ShipOption>
  > | null>(null);
  const contacts = useMemoizedContacts();
  const contactNames = Object.keys(contacts);
  const contactOptions = contactNames.map((contact) => ({
    value: contact,
    label: contacts[contact].nickname,
  }));
  const validShips = ships
    ? ships.every((ship) => ob.isValidPatp(ship.value))
    : false;

  // There is a known issue with react-select's performance for large lists of
  // of options, so filter the list of contact options to improve performance
  // See: https://github.com/JedWatson/react-select/issues/4516
  //      https://github.com/JedWatson/react-select/issues/3128
  const [inputValue, setInputValue] = useState('');
  const filteredOptions = useMemo(() => {
    if (!inputValue) {
      return contactOptions;
    }

    // fuzzy search both nicknames and patps; fuzzy#filter only supports
    // string comparision, so concat nickname + patp
    const searchSpace = Object.entries(contacts).map(
      (entry) => `${entry[1].nickname}${entry[0]}`
    );

    const fuzzyNames = fuzzy
      .filter(inputValue, searchSpace)
      .sort((a, b) => {
        const filter = deSig(inputValue) || '';
        const left = deSig(a.string)?.startsWith(filter)
          ? a.score + 1
          : a.score;
        const right = deSig(b.string)?.startsWith(filter)
          ? b.score + 1
          : b.score;

        return right - left;
      })
      .map((result) => contactNames[result.index]);

    return fuzzyNames.map((contact) => ({
      value: contact,
      label: contacts[contact].nickname,
    }));
  }, [contactNames, contactOptions, contacts, inputValue]);

  const slicedOptions = useMemo(
    () => filteredOptions.slice(0, MAX_DISPLAYED_OPTIONS),
    [filteredOptions]
  );

  const onKeyDown = async (event: React.KeyboardEvent<HTMLDivElement>) => {
    const isInputting = !!(
      selectRef.current && selectRef.current.inputRef?.value
    );

    switch (event.key) {
      case 'Backspace': {
        // case when user's in the midst of entering annother patp;
        // Do nothing so the user can remove one of the entered characters
        if (isInputting) {
          return;
        }
        // otherwise, remove the previously entered patp
        const newShips = ships.slice();
        newShips.pop();
        setShips([...newShips]);
        break;
      }
      case 'Enter': {
        // case when user is typing another patp: do nothing so react-select can
        // can add to the list of patps
        if (isInputting) {
          return;
        }
        if (ships && ships.length > 0 && validShips && onEnter) {
          onEnter(ships);
        }
        break;
      }
      default:
        break;
    }
  };

  const onChange = (
    newValue: MultiValue<ShipOption>,
    actionMeta: ActionMeta<ShipOption>
  ) => {
    if (
      ['create-option', 'remove-value', 'select-option'].includes(
        actionMeta.action
      )
    ) {
      const validPatps = newValue.filter((o) =>
        ob.isValidPatp(preSig(o.value))
      );
      setShips(validPatps);
    }
  };

  return (
    <CreatableSelect
      ref={selectRef}
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
        option: (base, state) => ({
          ...base,
          backgroundColor: state.isFocused ? 'rgb(var(--colors-gray-50))' : '',
        }),
        valueContainer: (base) => ({
          ...base,
          padding: '0px 8px',
        }),
      }}
      aria-label="Ships"
      options={slicedOptions}
      value={ships}
      onChange={onChange}
      onInputChange={(val) => setInputValue(val)}
      isValidNewOption={(val) => (val ? ob.isValidPatp(preSig(val)) : false)}
      onKeyDown={onKeyDown}
      placeholder="Type a name ie; ~sampel-palnet"
      hideSelectedOptions
      // TODO: create custom filter for sorting potential DM participants.
      filterOption={() => true} // disable the default filter
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
