import cn from 'classnames';
import fuzzy from 'fuzzy';
import React, { useEffect, useImperativeHandle, useState } from 'react';
import { isValidPatp, clan } from 'urbit-ob';
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
              <ShipName name={i.id} full={clan(i.id) !== 'comet'} showAlias />
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

export const DISALLOWED_MENTION_CHARS = /[^\w\d-]/g;

function normalizeText(text: string): string {
  return text.replace(DISALLOWED_MENTION_CHARS, '');
}

// assumes already lowercased
function scoreEntry(filter: string, entry: fuzzy.FilterResult<string>): number {
  const parts = entry.string.split('~');

  // shouldn't happen
  if (parts.length === 1) {
    return entry.score;
  }

  const [nickname, ship] = parts;
  // downrank comets significantly
  const score = ship.length > 28 ? entry.score * 0.25 : entry.score;

  // making this highest because ships are unique, nicknames are not
  // also prevents someone setting their nickname as someone else's
  // patp taking over prime position
  if (ship === filter) {
    return score + 120;
  }

  if (nickname === filter) {
    return score + 100;
  }

  // since ship is in the middle of the string we need to make it work
  // as if it was at the beginning
  if (nickname && ship.startsWith(filter)) {
    return score + 80;
  }

  return score;
}

const MentionPopup: Partial<SuggestionOptions> = {
  char: '~',
  items: ({ query }) => {
    const { contacts } = useContactState.getState();
    const sigged = preSig(query);
    const valid = isValidPatp(sigged);

    const contactNames = Object.keys(contacts);

    // fuzzy search both nicknames and patps; fuzzy#filter only supports
    // string comparision, so concat nickname + patp
    const searchSpace = Object.entries(contacts).map(([patp, contact]) =>
      `${normalizeText(contact.nickname)}${patp}`.toLocaleLowerCase()
    );

    if (valid && !contactNames.includes(sigged)) {
      contactNames.push(sigged);
      searchSpace.push(sigged);
    }

    const normQuery = normalizeText(query).toLocaleLowerCase();
    const fuzzyNames = fuzzy.filter(normQuery, searchSpace).sort((a, b) => {
      const filter = deSig(query) || '';
      const right = scoreEntry(filter, b);
      const left = scoreEntry(filter, a);
      return right - left;
    });

    const items = fuzzyNames
      .slice(0, 5)
      .map((entry) => ({ id: contactNames[entry.index] }));
    console.log(fuzzyNames.slice(0, 5));

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

        if (DISALLOWED_MENTION_CHARS.test(props.query)) {
          popup[0].destroy();
          component?.destroy();
          return;
        }

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
