import ExclamationPoint from '@/components/icons/ExclamationPoint';
import MagnifyingGlass16Icon from '@/components/icons/MagnifyingGlass16Icon';
import X16Icon from '@/components/icons/X16Icon';
import { MAX_DISPLAYED_OPTIONS } from '@/constants';
import GroupAvatar from '@/groups/GroupAvatar';
import { preSig, whomIsFlag } from '@/logic/utils';
import { useGroup, useGroups } from '@/state/groups';
import { deSig } from '@urbit/api';
import fuzzy from 'fuzzy';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActionMeta,
  ClearIndicatorProps,
  ControlProps,
  GroupBase,
  InputActionMeta,
  InputProps,
  MenuListProps,
  MenuProps,
  MultiValue,
  MultiValueGenericProps,
  MultiValueRemoveProps,
  OptionProps,
  type SelectInstance,
  SingleValue,
  ValueContainerProps,
  components,
} from 'react-select';
import CreatableSelect from 'react-select/creatable';
import ob from 'urbit-ob';

import LoadingSpinner from './LoadingSpinner/LoadingSpinner';
import ShipName from './ShipName';

export interface GroupOption {
  value: string;
  label: string;
}

interface GroupSelectorProps {
  groups: GroupOption[];
  setGroups: React.Dispatch<React.SetStateAction<GroupOption[]>>;
  onEnter?: (groups: GroupOption[]) => void;
  isMulti?: boolean;
  autoFocus?: boolean;
  isClearable?: boolean;
  isLoading?: boolean;
  hasPrompt?: boolean;
  placeholder?: string;
  isValidNewOption?: (value: string) => boolean;
}

function Control({ children, ...props }: ControlProps<GroupOption, true>) {
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

function ClearIndicator({ ...props }: ClearIndicatorProps<GroupOption, true>) {
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

function GroupItem({ data, ...props }: OptionProps<GroupOption, true>) {
  const { value: rawValue, label } = data;
  const value = preSig(rawValue);
  const group = useGroup(value);
  return (
    <components.Option data={data} className="hover:cursor-pointer" {...props}>
      <div className="flex items-center space-x-1">
        <GroupAvatar {...group?.meta} className="mr-2" />
        {label ? (
          <span className="font-semibold">{label}</span>
        ) : (
          <span className="font-semibold text-gray-300">{value}</span>
        )}
      </div>
    </components.Option>
  );
}

function NoGroupsMessage() {
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
    <NoGroupsMessage />
  );
}

function GroupTagLabelContainer({
  children,
  ...props
}: MultiValueGenericProps<GroupOption, true>) {
  return (
    <components.MultiValueContainer {...props}>
      <div className="flex">{children}</div>
    </components.MultiValueContainer>
  );
}

function SingleValueGroupTagLabelContainer({
  children,
  ...props
}: ValueContainerProps<GroupOption, true>) {
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
            Add to Favorites
          </button>
        ) : null}
      </div>
    </components.ValueContainer>
  );
}

function SingleGroupLabel({ data }: { data: GroupOption }) {
  const { value } = data;
  return (
    <div className="flex h-6 items-center rounded bg-gray-100">
      <span className="px-2 py-1 font-semibold">{value}</span>
    </div>
  );
}

function GroupTagLabel({ data }: { data: GroupOption }) {
  const { value } = data;
  return (
    <div className="flex h-6 items-center rounded-l bg-gray-100">
      <span className="p-1 font-semibold">{value}</span>
    </div>
  );
}

function GroupTagRemove(props: MultiValueRemoveProps<GroupOption, true>) {
  return (
    <components.MultiValueRemove {...props}>
      <div className="flex h-full items-center rounded-r bg-gray-100 pr-1">
        <X16Icon className="h-4 text-gray-300" />
      </div>
    </components.MultiValueRemove>
  );
}

function GroupDropDownMenu({
  children,
  ...props
}: MenuProps<GroupOption, true>) {
  return (
    <components.Menu
      className="rounded-lg border-2 border-transparent"
      {...props}
    >
      {children}
    </components.Menu>
  );
}

function GroupDropDownMenuList({
  children,
  ...props
}: MenuListProps<GroupOption, true>) {
  return (
    <components.MenuList className="rounded-md bg-white" {...props}>
      {children}
    </components.MenuList>
  );
}

function Input({ children, ...props }: InputProps<GroupOption, true>) {
  return (
    <components.Input className="text-gray-800" {...props}>
      {children}
    </components.Input>
  );
}

export default function GroupSelector({
  groups,
  setGroups,
  onEnter,
  autoFocus = true,
  isMulti = true,
  isClearable = false,
  isLoading = false,
  hasPrompt = true,
  placeholder = 'Search for groups...',
  isValidNewOption = (val) => true,
}: GroupSelectorProps) {
  const selectRef = useRef<SelectInstance<
    GroupOption,
    true,
    GroupBase<GroupOption>
  > | null>(null);
  const groupData = useGroups();
  const groupFlags = Object.keys(groupData);
  const groupOptions = groupFlags.map((group) => ({
    value: group,
    label: groupData[group].meta.title,
  }));
  const validGroups = groups
    ? groups.every((group) => groupFlags.includes(group.value))
    : false;

  const handleEnter = () => {
    const isInputting = !!(
      selectRef.current && selectRef.current.inputRef?.value
    );

    // case when user is typing another patp: do nothing so react-select can
    // can add to the list of patps
    if (isInputting) {
      return;
    }
    if (groups && groups.length > 0 && validGroups && onEnter) {
      onEnter(groups);
      if (!isMulti) {
        setGroups([]);
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
      return groupOptions;
    }

    // fuzzy search both nicknames and patps; fuzzy#filter only supports
    // string comparision, so concat nickname + patp
    const searchSpace = Object.entries(groupData).map(
      ([flag, group]) => `${group.meta.title}${flag}`
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
      .map((result) => groupFlags[result.index]);

    return fuzzyNames.map((group) => ({
      value: group,
      label: groupData[group].meta.title,
    }));
  }, [groupFlags, groupOptions, groupData, inputValue]);

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
        const newGroups = groups.slice();
        newGroups.pop();
        setGroups([...newGroups]);
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
    newValue: MultiValue<GroupOption>,
    actionMeta: ActionMeta<GroupOption>
  ) => {
    if (
      ['create-option', 'remove-value', 'select-option'].includes(
        actionMeta.action
      )
    ) {
      const validFlags = newValue.filter((o) => groupFlags.includes(o.value));
      setGroups(validFlags);
    }
  };

  const singleOnChange = (
    newValue: SingleValue<GroupOption>,
    actionMeta: ActionMeta<GroupOption>
  ) => {
    if (
      ['create-option', 'remove-value', 'select-option'].includes(
        actionMeta.action
      ) &&
      newValue !== null
    ) {
      const validGroup = groupFlags.includes(newValue.value);
      if (validGroup) {
        setGroups([newValue]);
      }
    }
  };

  const onClear = () => {
    setGroups([]);
  };

  if (!isMulti) {
    return (
      <CreatableSelect
        handleEnter={handleEnter}
        ref={selectRef}
        formatCreateLabel={AddNewOption}
        autoFocus={autoFocus}
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
            backgroundColor: state.isFocused
              ? 'rgb(var(--colors-gray-50))'
              : '',
          }),
          valueContainer: (base) => ({
            ...base,
            padding: '0px 8px',
          }),
        }}
        aria-label="Groups"
        options={slicedOptions}
        value={groups}
        // @ts-expect-error this error is irrelevant
        onChange={singleOnChange}
        onInputChange={onInputChange}
        isValidNewOption={isValidNewOption}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        hideSelectedOptions
        // TODO: create custom filter for sorting potential DM participants.
        filterOption={() => true} // disable the default filter
        isClearable={isClearable}
        isLoading={isLoading}
        onClear={onClear}
        hasPrompt={hasPrompt}
        components={{
          Control,
          Menu: GroupDropDownMenu,
          MenuList: GroupDropDownMenuList,
          Input,
          DropdownIndicator: () => null,
          IndicatorSeparator: () => null,
          ClearIndicator,
          LoadingIndicator,
          Option: GroupItem,
          NoOptionsMessage: NoGroupsMessage,
          SingleValue: SingleGroupLabel,
          ValueContainer: SingleValueGroupTagLabelContainer,
        }}
      />
    );
  }

  return (
    <CreatableSelect
      ref={selectRef}
      formatCreateLabel={AddNewOption}
      autoFocus={autoFocus}
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
      aria-label="Groups"
      options={slicedOptions}
      value={groups}
      onChange={onChange}
      onInputChange={onInputChange}
      isValidNewOption={isValidNewOption}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      hideSelectedOptions
      // TODO: create custom filter for sorting potential DM participants.
      filterOption={() => true} // disable the default filter
      isClearable={isClearable}
      isLoading={isLoading}
      components={{
        Control,
        Menu: GroupDropDownMenu,
        MenuList: GroupDropDownMenuList,
        Input,
        DropdownIndicator: () => null,
        IndicatorSeparator: () => null,
        LoadingIndicator,
        ClearIndicator,
        Option: GroupItem,
        NoOptionsMessage: NoGroupsMessage,
        MultiValueLabel: GroupTagLabel,
        MultiValueContainer: GroupTagLabelContainer,
        MultiValueRemove: GroupTagRemove,
      }}
    />
  );
}
