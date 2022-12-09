import cn from 'classnames';
import fuzzy from 'fuzzy';
import React, { useEffect, useImperativeHandle, useState } from 'react';
import { isValidPatp } from 'urbit-ob';
import { ReactRenderer } from '@tiptap/react';
import { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import tippy from 'tippy.js';
import { deSig } from '@urbit/api';
import useContactState, { useContacts } from '@/state/contact';
import { preSig } from '@/logic/utils';
import Avatar from '../Avatar';
import ShipName from '../ShipName';

interface MentionListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const MentionList = React.forwardRef<
  MentionListHandle,
  SuggestionProps<{ id: string }>
>((props, ref) => {
  const contacts = useContacts();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];

    if (item) {
      props.command({ id: deSig(item.id) || '' });
    }
  };

  const upHandler = () => {
    setSelectedIndex(
      (selectedIndex + props.items.length - 1) % props.items.length
    );
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        event.stopPropagation();
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <div className="dropdown p-1">
      <ul>
        {(props.items || []).map((i, index) => (
          <li key={i.id}>
            <button
              className={cn(
                'dropdown-item flex w-full items-center space-x-2',
                index === selectedIndex && 'bg-gray-50'
              )}
              onClick={() => selectItem(index)}
            >
              <Avatar size="xs" ship={i.id} />
              <ShipName name={i.id} showAlias />
              {contacts[i.id]?.nickname ? (
                <ShipName name={i.id} className="text-gray-400" />
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});

const MentionPopup: Partial<SuggestionOptions> = {
  char: '~',
  items: ({ query }) => {
    const { contacts } = useContactState.getState();
    const sigged = preSig(query);
    const valid = isValidPatp(sigged);

    const contactNames = Object.keys(contacts);

    // fuzzy search both nicknames and patps; fuzzy#filter only supports
    // string comparision, so concat nickname + patp
    const searchSpace = Object.entries(contacts).map(
      ([patp, contact]) => `${contact.nickname}${patp}`
    );

    if (valid && !contactNames.includes(sigged)) {
      contactNames.push(sigged);
      searchSpace.push(sigged);
    }

    const fuzzyNames = fuzzy
      .filter(query, searchSpace)
      .sort((a, b) => {
        const filter = deSig(query) || '';
        const left = deSig(a.string)?.startsWith(filter)
          ? a.score + 1
          : a.score;
        const right = deSig(b.string)?.startsWith(filter)
          ? b.score + 1
          : b.score;

        return right - left;
      })
      .map((result) => contactNames[result.index]);

    const items = fuzzyNames.slice(0, 5).map((id) => ({ id }));

    return items;
  },

  render: () => {
    let component: ReactRenderer<
      MentionListHandle,
      SuggestionProps<{ id: string }>
    >;
    let popup: any;
    return {
      onStart: (props) => {
        component = new ReactRenderer<
          MentionListHandle,
          SuggestionProps<{ id: string }>
        >(MentionList, { props, editor: props.editor });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as any,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'top-start',
        });
      },
      onUpdate: (props) => {
        component.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup[0].setProps({
          getBoundingClientRect: props.clientRect,
        });
      },
      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          popup[0]?.hide();
          return true;
        }
        return component?.ref?.onKeyDown(props.event) || false;
      },
      onExit: () => {
        popup[0].destroy();
        component?.destroy();
      },
    };
  },
};

export default MentionPopup;
