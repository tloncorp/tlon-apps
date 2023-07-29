import React, { useEffect, useState, useRef, forwardRef } from 'react';
import {
  Cross2Icon,
  PlusCircledIcon,
  ExclamationTriangleIcon,
} from '@radix-ui/react-icons';
import {
  components,
  ControlProps,
  OptionProps,
  MenuProps,
  MenuListProps,
  NoticeProps,
  InputProps,
  MultiValueRemoveProps,
  MultiValueGenericProps,
  MultiValue,
  ActionMeta,
  ValueContainerProps,
  ClearIndicatorProps,
  InputActionMeta,
  Props as SelectProps,
  GroupBase,
  CSSObjectWithLabel as StylesBase,
} from 'react-select';
import {
  CreatableProps as CreatableSelectProps,
} from 'react-select/creatable';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import UrbitIcon from '@/components/icons/UrbitIcon';


export interface SelectorOption {
  value: string;
  label: string;
}
export type SelectorProps<IsMulti extends boolean> =
  SelectProps<SelectorOption, IsMulti, GroupBase<SelectorOption>>;
export type SingleSelectorProps = SelectorProps<false>;
export type MultiSelectorProps = SelectorProps<true>;
export type CreatableSelectorProps<IsMulti extends boolean> =
  CreatableSelectProps<SelectorOption, IsMulti, GroupBase<SelectorOption>>;
export type SingleCreatableSelectorProps = CreatableSelectorProps<false>;
export type MultiCreatableSelectorProps = CreatableSelectorProps<true>;


const DEFAULT_PROPS = {
  placeholder: "",
  autoFocus: false,
  isClearable: true,
  isLoading: false,
};
const OVERRIDE_PROPS = {
  menuShouldScrollIntoView: false,
  hideSelectedOptions: true,
  hasPrompt: false,
  // formatCreateLabel: NewOptionMessage,
  styles: {
    control: (base: StylesBase) => ({}),
    menu: ({width, borderRadius, ...base}: StylesBase) => ({
      ...base,
      borderWidth: '',
      borderColor: '',
      zIndex: 50,
      backgroundColor: 'inherit',
    }),
    input: (base: StylesBase) => ({
      ...base,
      margin: '',
      color: '',
      paddingTop: '',
      paddingBottom: '',
    }),
    multiValue: (base: StylesBase) => ({
      ...base,
      backgroundColor: '',
      margin: '0 2px', // FIXME: Can change to '2px 2px' to prevent mobile cramping, but imperfect solution
    }),
    multiValueRemove: (base: StylesBase) => ({
      ...base,
      paddingRight: '',
      paddingLeft: '',
      '&:hover': {
        color: 'inherit',
        backgroundColor: 'inherit',
      },
    }),
    option: (base: StylesBase, state: OptionProps<SelectorOption, true>) => ({
      ...base,
      backgroundColor: state.isFocused
        ? 'rgb(var(--colors-gray-50))'
        : '',
    }),
    valueContainer: (base: StylesBase) => ({
      ...base,
      padding: '0px',
    }),
  },
  components: {
    Control,
    Menu,
    MenuList,
    Input,
    ClearIndicator,
    LoadingIndicator,
    NoOptionsMessage,
    // SingleValue,
    // ValueContainer,
    MultiValueLabel,
    MultiValueContainer,
    MultiValueRemove,
    DropdownIndicator: () => null,
    IndicatorSeparator: () => null,
  },
};


export const SingleSelector = forwardRef<
  any,
  SingleSelectorProps
>((props, ref) => (
  <Select
    ref={ref}
    isMulti={false}
    {...Object.assign({}, DEFAULT_PROPS, props, OVERRIDE_PROPS)}
  />
));

export const MultiSelector = forwardRef<
  any,
  MultiSelectorProps
>((props, ref) => (
  <Select
    ref={ref}
    isMulti={true}
    {...Object.assign({}, DEFAULT_PROPS, props, OVERRIDE_PROPS)}
  />
));

export const CreatableSingleSelector = forwardRef<
  any,
  SingleCreatableSelectorProps
>((props, ref) => (
  <CreatableSelect
    ref={ref}
    isMulti={false}
    {...Object.assign({}, DEFAULT_PROPS, props, OVERRIDE_PROPS)}
  />
));

export const CreatableMultiSelector = forwardRef<
  any,
  MultiCreatableSelectorProps
>((props, ref) => (
  <CreatableSelect
    ref={ref}
    isMulti={true}
    {...Object.assign({}, DEFAULT_PROPS, props, OVERRIDE_PROPS)}
  />
));

function Control({ children, ...props }: ControlProps<SelectorOption, true>) {
  return (
    <components.Control
      {...props}
      className="input cursor-text items-center text-gray-800"
    >
      {children}
    </components.Control>
  );
}

function Menu({ children, ...props }: MenuProps<SelectorOption, true>) {
  return (
    <components.Menu
      className="rounded-lg outline outline-0 outline-gray-100 dark:outline-2"
      {...props}
    >
      {children}
    </components.Menu>
  );
}

function MenuList({
  children,
  ...props
}: MenuListProps<SelectorOption, true>) {
  return (
    <components.MenuList
      className="hide-scroll rounded-lg bg-white p-2"
      {...props}
    >
      {children}
    </components.MenuList>
  );
}

function Input({ children, ...props }: InputProps<SelectorOption, true>) {
  return (
    <components.Input className="py-0.5 text-gray-800" {...props}>
      {children}
    </components.Input>
  );
}

function ClearIndicator({ ...props }: ClearIndicatorProps<SelectorOption, true>) {
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
      <Cross2Icon className="h-4 w-4" />
    </span>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex justify-center">
      <UrbitIcon className="animate-spin w-6 h-6 fill-stone-900" />
    </div>
  );
}

function NoOptionsMessage({
  children,
  ...props
}: NoticeProps<SelectorOption, true>) {
  return (
    <div className="flex content-center space-x-1 px-2 py-3">
      <ExclamationTriangleIcon className="mr-2 w-6 h-6 text-gray-300" />
      <span className="italic">
        {children}
      </span>
    </div>
  );
}

function NewOptionMessage(value: string) {
  // FIXME: Allow for customization of contents of message.
  return (
    <div className="flex content-center space-x-1 px-2 py-3">
      <PlusCircledIcon className="mr-2 w-6 h-6 text-gray-300" />
      <span className="italic">
        Create new option {value}.
      </span>
    </div>
  );
}

function MultiValueContainer({
  children,
  ...props
}: MultiValueGenericProps<SelectorOption, true>) {
  return (
    <components.MultiValueContainer {...props}>
      <div className="flex">{children}</div>
    </components.MultiValueContainer>
  );
}

function ValueContainer({
  children,
  ...props
}: ValueContainerProps<SelectorOption, true>) {
  return (
    <components.ValueContainer {...props} className="flex">
      <div className="flex justify-between">
        {children}
      </div>
    </components.ValueContainer>
  );
}

function SingleValue({data}: {data: SelectorOption}) {
  const {value} = data;
  return (
    <div className="flex h-6 items-center rounded bg-gray-100">
      <span className="py-1 px-2 font-semibold">{value}</span>
    </div>
  );
}

function MultiValueLabel({data}: {data: SelectorOption}) {
  const {value} = data;
  return (
    <div className="flex h-6 items-center rounded-l bg-gray-100">
      <span className="p-1 font-semibold">{value}</span>
    </div>
  );
}

function MultiValueRemove(props: MultiValueRemoveProps<SelectorOption, true>) {
  return (
    <components.MultiValueRemove {...props}>
      <div className="flex h-full items-center rounded-r bg-gray-100 pr-1">
        <Cross2Icon className="h-4 text-gray-300" />
      </div>
    </components.MultiValueRemove>
  );
}
