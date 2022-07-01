import React, { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import ob from 'urbit-ob';
import {
  components,
  ControlProps,
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
import MagnifyingGlass from '../components/icons/MagnifyingGlass16Icon';
import ExclamationPoint from '../components/icons/ExclamationPoint';
import X16Icon from '../components/icons/X16Icon';
import { newUv, preSig } from '../logic/utils';
import createClub from '../state/chat/createClub';
import { DM_INPUT_CONTACTS_LIMIT } from '../constants';
import ShipMenuOption from './DMInviteInput/ShipMenuOption';
import { IShipOptionRenderer } from './NodeScroller/IShipOptionRender';
import ShipOptionScroller from './NodeScroller/ShipOptionScroller';
import { useMemoizedContacts } from '../state/contact';
import ShipOption from './DMInviteInput/ShipOption';

interface DmInviteInputProps {
  ships: ShipOption[];
  setShips: React.Dispatch<React.SetStateAction<ShipOption[]>>;
  fromMulti?: boolean;
  clubId?: string;
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
  const { value } = data;
  return (
    <div className="flex h-6 items-center rounded-l bg-gray-100">
      <span className="p-1 font-semibold">{value}</span>
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
      {
        Array.isArray(children)
          ? children.slice(0, DM_INPUT_CONTACTS_LIMIT) /* Options */
          : children /* NoOptionsLabel */
      }
    </components.MenuList>
  );
}

function VirtualizedShipDropDownMenuList({
  children,
  ...props
}: MenuListProps<ShipOption, true>) {
  const height = Array.isArray(children)
    ? children.length < 5
      ? children.length * 40
      : 200
    : 40;

  return (
    // TODO: menu height

    <components.MenuList
      className={`h-[${height}px] rounded-md bg-white`}
      {...props}
    >
      {
        Array.isArray(children) /* Options */ ? (
          <ShipOptionScroller
            options={children}
            renderer={React.forwardRef<
              typeof ShipMenuOption,
              IShipOptionRenderer
            >(
              // TODO: do we still need the ref?
              ({ index }: IShipOptionRenderer, ref) => {
                const node = children[index.toJSNumber()];
                return node ?? null;
              }
            )}
          />
        ) : (
          children
        ) /* NoOptionsLabel */
      }
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

export default function DMInviteInput({
  ships,
  setShips,
  fromMulti = false,
  clubId,
}: DmInviteInputProps) {
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
  const navigate = useNavigate();
  const validShips = ships
    ? ships.every((ship) => ob.isValidPatp(ship.value))
    : false;

  const isMulti = ships.length > 1;
  const newClubId = useMemo(() => clubId || newUv(), [clubId]);

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
        if (ships && ships.length > 0 && validShips) {
          if (isMulti) {
            await createClub(
              newClubId,
              ships.map((s) => s.value)
            );
            navigate(`/dm/${newClubId}`);
          } else if (fromMulti) {
            // club already created, inviting new user to existing club
            navigate(`/dm/${clubId}`);
          } else {
            navigate(`/dm/${ships[0].value}`);
          }
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
      maxMenuHeight={300}
      components={{
        Control,
        Menu: ShipDropDownMenu,
        // MenuList: ShipDropDownMenuList,
        MenuList: VirtualizedShipDropDownMenuList,
        Input,
        DropdownIndicator: () => null,
        IndicatorSeparator: () => null,
        ClearIndicator: () => null,
        Option: ShipMenuOption,
        NoOptionsMessage: NoShipsMessage,
        MultiValueLabel: ShipTagLabel,
        MultiValueContainer: ShipTagLabelContainer,
        MultiValueRemove: ShipTagRemove,
      }}
    />
  );
}
