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
  SingleValue,
  ValueContainerProps,
  ClearIndicatorProps,
  InputActionMeta,
} from 'react-select';
import { includes } from 'lodash';
import CreatableSelect from 'react-select/creatable';
import Select from 'react-select/dist/declarations/src/Select';
import { deSig } from '@urbit/api';
import ExclamationPoint from '@/components/icons/ExclamationPoint';
import X16Icon from '@/components/icons/X16Icon';
import { preSig, whomIsFlag } from '@/logic/utils';
import Avatar from '@/components/Avatar';
import { useMemoizedContacts } from '@/state/contact';
import { MAX_DISPLAYED_OPTIONS } from '@/constants';
import MagnifyingGlass16Icon from '@/components/icons/MagnifyingGlass16Icon';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useIsMobile } from '@/logic/useMedia';
import ShipName from './ShipName';
import UnknownAvatarIcon from './icons/UnknownAvatarIcon';

export interface ShipOption {
  value: string;
  label: string;
}

interface ShipSelectorProps {
  ships: ShipOption[];
  setShips: React.Dispatch<React.SetStateAction<ShipOption[]>>;
  onEnter?: (ships: ShipOption[]) => void;
  isMulti?: boolean;
  isClearable?: boolean;
  isLoading?: boolean;
  hasPrompt?: boolean;
  inner?: boolean;
  placeholder?: string;
  isValidNewOption?: (value: string) => boolean;
}

function Control({ children, ...props }: ControlProps<ShipOption, true>) {
  return (
    <components.Control
      {...props}
      className="input cursor-text items-center text-gray-800"
    >
      <MagnifyingGlass16Icon className="h-4 w-4 text-gray-300" />
      {children}
    </components.Control>
  );
}

function InnerControl({ children, ...props }: ControlProps<ShipOption, true>) {
  return (
    <components.Control
      {...props}
      className="input-inner cursor-text items-center px-0 text-gray-800"
    >
      {children}
    </components.Control>
  );
}

function ClearIndicator({ ...props }: ClearIndicatorProps<ShipOption, true>) {
  const clearValue = () => {
    props.clearValue();
    // reset state in parent
    // @ts-expect-error we passed an extra prop to selectProps
    if (props.selectProps.onClear) {
      // @ts-expect-error we passed an extra prop to selectProps
      props.selectProps.onClear();
    }
  };

  const innerProps = {
    ...props.innerProps,
    onMouseDown: clearValue,
    onTouchEnd: clearValue,
  };

  return (
    <span {...innerProps} className="cursor-pointer">
      <X16Icon className="h-4 w-4" />
    </span>
  );
}

function LoadingIndicator() {
  return <LoadingSpinner />;
}

function SearchGroupMessage({ value }: { value: string }) {
  return (
    <div className="flex content-center space-x-1 px-2 py-3 text-gray-400">
      <span className="italic">Search for {value}</span>
    </div>
  );
}

function ShipItem({ data, ...props }: OptionProps<ShipOption, true>) {
  const { value: rawValue, label } = data;
  const value = preSig(rawValue);
  return (
    <components.Option
      data={data}
      className="rounded-lg p-2 hover:cursor-pointer"
      {...props}
    >
      <div className="flex items-center space-x-2">
        {
          // Case when user has entered an invite link (e.g., ~zod/group-name)
          whomIsFlag(value) ? (
            <UnknownAvatarIcon className="w-[18px] text-gray-400" />
          ) : // Normal case, searching for a nickname or patp
          ob.isValidPatp(value) ? (
            <Avatar ship={value} size="xs" />
          ) : (
            <div className="h-6 w-6 rounded bg-white" />
          )
        }
        {whomIsFlag(value) ? (
          <SearchGroupMessage value={value} />
        ) : label ? (
          <>
            <span className="font-semibold">{label}</span>
            <ShipName name={value} className="font-semibold text-gray-300" />
          </>
        ) : (
          <ShipName name={value} showAlias className="font-semibold" />
        )}
      </div>
    </components.Option>
  );
}

function NoShipsMessage() {
  return (
    <div className="flex content-center space-x-1 px-2 py-3">
      <ExclamationPoint className="mr-2 w-[18px] text-gray-300" />
      <span className="italic">This name was not found.</span>
    </div>
  );
}

function AddNewOption(value: string) {
  return whomIsFlag(value) ? (
    <SearchGroupMessage value={value} />
  ) : ob.isValidPatp(preSig(value)) ? null : (
    <NoShipsMessage />
  );
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

function SingleValueShipTagLabelContainer({
  children,
  ...props
}: ValueContainerProps<ShipOption, true>) {
  return (
    <components.ValueContainer {...props} className="flex">
      <div className="flex justify-between">
        {children}
        {props.hasValue &&
        // @ts-expect-error we passed an extra prop to selectProps
        props.selectProps.hasPrompt ? (
          <button
            className="font-semibold text-gray-400"
            // @ts-expect-error we passed an extra prop to selectProps
            onClick={props.selectProps.handleEnter}
          >
            Enter
          </button>
        ) : null}
      </div>
    </components.ValueContainer>
  );
}

function SingleShipLabel({ data }: { data: ShipOption }) {
  const { value } = data;
  return (
    <div className="flex h-6 items-center rounded bg-gray-100">
      <ShipName name={value} showAlias className="py-1 px-2 font-semibold" />
    </div>
  );
}

function ShipTagLabel({ data }: { data: ShipOption }) {
  const { value } = data;
  return (
    <div className="flex h-6 items-center rounded-l bg-gray-100">
      <ShipName name={value} showAlias className="p-1 font-semibold" />
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
    <components.Menu
      className="rounded-lg outline outline-0 outline-gray-100 dark:outline-2"
      {...props}
    >
      {children}
    </components.Menu>
  );
}

function ShipDropDownMenuList({
  children,
  ...props
}: MenuListProps<ShipOption, true>) {
  return (
    <components.MenuList
      className="hide-scroll rounded-lg bg-white p-2"
      {...props}
    >
      {children}
    </components.MenuList>
  );
}

function Input({ children, ...props }: InputProps<ShipOption, true>) {
  return (
    <components.Input className="py-0.5 text-gray-800" {...props}>
      {children}
    </components.Input>
  );
}

export default function ShipSelector({
  ships,
  setShips,
  onEnter,
  isMulti = true,
  isClearable = false,
  inner = false,
  isLoading = false,
  hasPrompt = true,
  placeholder = 'Search for Urbit ID (e.g. ~sampel-palnet) or display name',
  isValidNewOption = (val) => (val ? ob.isValidPatp(preSig(val)) : false),
}: ShipSelectorProps) {
  const selectRef = useRef<Select<
    ShipOption,
    true,
    GroupBase<ShipOption>
  > | null>(null);
  const isMobile = useIsMobile();
  const contacts = useMemoizedContacts();
  const contactNames = Object.keys(contacts);
  const contactOptions = contactNames.map((contact) => ({
    value: contact,
    label: contacts[contact].nickname,
  }));
  const validShips = ships
    ? ships.every((ship) => isValidNewOption(preSig(ship.value)))
    : false;
  const mobilePlaceholder = 'Search by @p or nickname';

  const handleEnter = () => {
    const isInputting = !!(
      selectRef.current && selectRef.current.inputRef?.value
    );

    // case when user is typing another patp: do nothing so react-select can
    // can add to the list of patps
    if (isInputting) {
      return;
    }
    if (ships && ships.length > 0 && validShips && onEnter) {
      onEnter(ships);
      if (!isMulti) {
        setShips([]);
      }
    }
  };

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
      ([patp, contact]) => `${contact.nickname}${patp}`
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
        handleEnter();
        break;
      }
      default:
        break;
    }
  };

  const onInputChange = (newValue: string, _actionMeta: InputActionMeta) => {
    setInputValue(newValue);
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
        isValidNewOption(preSig(o.value))
      );
      setShips(validPatps);
    }
  };

  const singleOnChange = (
    newValue: SingleValue<ShipOption>,
    actionMeta: ActionMeta<ShipOption>
  ) => {
    if (
      ['create-option', 'remove-value', 'select-option'].includes(
        actionMeta.action
      ) &&
      newValue !== null
    ) {
      const validPatp = isValidNewOption(preSig(newValue.value));
      if (validPatp) {
        setShips([newValue]);
      }
    }
  };

  const onClear = () => {
    setShips([]);
  };

  if (!isMulti) {
    return (
      <CreatableSelect
        handleEnter={handleEnter}
        ref={selectRef}
        formatCreateLabel={AddNewOption}
        autoFocus
        styles={{
          control: (base) => ({}),
          menu: ({ width, borderRadius, ...base }) => ({
            ...base,
            borderWidth: '',
            borderColor: '',
            zIndex: 50,
            backgroundColor: 'inherit',
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
            backgroundColor: state.isFocused
              ? 'rgb(var(--colors-gray-50))'
              : '',
          }),
          valueContainer: (base) => ({
            ...base,
            padding: '0px 8px',
          }),
        }}
        aria-label="Ships"
        options={slicedOptions}
        value={ships}
        // @ts-expect-error this error is irrelevant
        onChange={singleOnChange}
        onInputChange={onInputChange}
        isValidNewOption={(val) =>
          includes(
            slicedOptions.map((o) => o.value),
            preSig(val)
          )
            ? false
            : isValidNewOption(val)
        }
        onKeyDown={onKeyDown}
        placeholder={isMobile ? mobilePlaceholder : placeholder}
        hideSelectedOptions
        // TODO: create custom filter for sorting potential DM participants.
        filterOption={() => true} // disable the default filter
        isClearable={isClearable}
        isLoading={isLoading}
        onClear={onClear}
        hasPrompt={hasPrompt}
        components={{
          Control: inner ? InnerControl : Control,
          Menu: ShipDropDownMenu,
          MenuList: ShipDropDownMenuList,
          Input,
          DropdownIndicator: () => null,
          IndicatorSeparator: () => null,
          ClearIndicator,
          LoadingIndicator,
          Option: ShipItem,
          NoOptionsMessage: NoShipsMessage,
          SingleValue: SingleShipLabel,
          ValueContainer: SingleValueShipTagLabelContainer,
        }}
      />
    );
  }

  return (
    <CreatableSelect
      ref={selectRef}
      formatCreateLabel={AddNewOption}
      autoFocus
      isMulti
      styles={{
        control: (base) => ({}),
        menuList: ({ padding, paddingTop, paddingBottom, ...base }) => ({
          ...base,
        }),
        menu: ({
          paddingTop,
          paddingBottom,
          padding,
          width,
          borderRadius,
          ...base
        }) => ({
          ...base,
          borderWidth: '',
          borderColor: '',
          zIndex: 50,
          backgroundColor: 'inherit',
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
        option: ({ padding, ...base }, state) => ({
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
      onInputChange={onInputChange}
      isValidNewOption={(val) =>
        includes(
          slicedOptions.map((o) => o.value),
          preSig(val)
        )
          ? false
          : isValidNewOption(val)
      }
      onKeyDown={onKeyDown}
      placeholder={isMobile ? mobilePlaceholder : placeholder}
      hideSelectedOptions
      // TODO: create custom filter for sorting potential DM participants.
      filterOption={() => true} // disable the default filter
      isClearable={isClearable}
      isLoading={isLoading}
      components={{
        Control: inner ? InnerControl : Control,
        Menu: ShipDropDownMenu,
        MenuList: ShipDropDownMenuList,
        Input,
        DropdownIndicator: () => null,
        IndicatorSeparator: () => null,
        LoadingIndicator,
        ClearIndicator,
        Option: ShipItem,
        NoOptionsMessage: NoShipsMessage,
        MultiValueLabel: ShipTagLabel,
        MultiValueContainer: ShipTagLabelContainer,
        MultiValueRemove: ShipTagRemove,
      }}
    />
  );
}
