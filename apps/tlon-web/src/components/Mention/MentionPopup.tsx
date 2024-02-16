import keyMap from '@/keyMap';
import { isNativeApp } from '@/logic/native';
import { preSig } from '@/logic/utils';
import { useMultiDms } from '@/state/chat';
import useContactState, { useContacts } from '@/state/contact';
import { useGroup, useGroupFlag } from '@/state/groups';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { deSig } from '@urbit/api';
import cn from 'classnames';
import fuzzy from 'fuzzy';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { useMatch } from 'react-router';
import tippy from 'tippy.js';
import { clan, isValidPatp } from 'urbit-ob';

import Avatar from '../Avatar';
import useLeap from '../Leap/useLeap';
import ShipName from '../ShipName';

interface MentionListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const MentionList = React.forwardRef<
  MentionListHandle,
  SuggestionProps<{ id: string }>
>((props, ref) => {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const multiDms = useMultiDms();
  const match = useMatch('/dm/:ship');
  const contacts = useContacts();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { isOpen: leapIsOpen } = useLeap();

  const getMessage = useCallback(
    (ship: string) => {
      if (ship === window.our) {
        return null;
      }

      if (match) {
        const multiDm = match && multiDms[match.params.ship || ''];
        if (multiDm) {
          return ![...multiDm.hive, ...multiDm.team].includes(ship)
            ? 'Not in message'
            : null;
        }

        return ship !== match.params.ship ? 'Not in message' : null;
      }

      return !group?.fleet[ship] ? 'Not in group' : null;
    },
    [group, multiDms, match]
  );

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

  useEffect(
    () => setSelectedIndex(isNativeApp() ? props.items.length - 1 : 0),
    [props.items]
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (leapIsOpen) return false;
      if (event.key === keyMap.mentionPopup.prevItem) {
        upHandler();
        return true;
      }

      if (event.key === keyMap.mentionPopup.nextItem) {
        downHandler();
        return true;
      }

      if (event.key === keyMap.mentionPopup.selectItem) {
        event.stopPropagation();
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <div
      className={cn(
        'dropdown mb-2 p-1',
        isNativeApp() ? 'w-[100vw]' : 'min-w-80'
      )}
    >
      <ul className="w-full">
        {(props.items || []).map((i: any, index: number) => (
          <li key={i.id} className="w-full">
            <button
              className={cn(
                'dropdown-item flex w-full items-center space-x-2 text-left text-sm',
                index === selectedIndex && 'bg-gray-50'
              )}
              onClick={() => selectItem(index)}
            >
              <Avatar size="xs" ship={i.id} />
              <ShipName name={i.id} full={clan(i.id) !== 'comet'} showAlias />
              {contacts[i.id]?.nickname ? (
                <ShipName name={i.id} className="text-gray-400" />
              ) : null}
              {getMessage(i.id) ? (
                <span className="flex-1 pl-6 text-right font-normal text-gray-400">
                  {getMessage(i.id)}
                </span>
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

export default function getMentionPopup(
  triggerChar: string
): Partial<SuggestionOptions> {
  return {
    char: triggerChar,
    pluginKey: new PluginKey(`${triggerChar}-mention-popup`),
    items: ({ query }) => {
      const { contacts } = useContactState.getState();
      const sigged = preSig(query);
      const valid = isValidPatp(sigged);

      const contactNames = Object.keys(contacts);

      // fuzzy search both nicknames and patps; fuzzy#filter only supports
      // string comparision, so concat nickname + patp
      const searchSpace = Object.entries(contacts).map(([patp, contact]) =>
        `${normalizeText(contact?.nickname || '')}${patp}`.toLocaleLowerCase()
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

      if (isNativeApp()) {
        items.reverse();
      }

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
            placement: isNativeApp() ? 'top' : 'top-start',
            onMount: ({ popperInstance }) => {
              popperInstance?.setOptions({
                placement: isNativeApp() ? 'top' : 'top-start',
                modifiers: [{ name: 'flip', enabled: false }],
              });
            },
            onAfterUpdate: ({ popperInstance }) => {
              popperInstance?.setOptions({
                placement: isNativeApp() ? 'top' : 'top-start',
                modifiers: [{ name: 'flip', enabled: false }],
              });
            },
          });
        },
        onUpdate: (props) => {
          component.updateProps(props);

          if (DISALLOWED_MENTION_CHARS.test(props.query)) {
            popup?.[0]?.destroy();
            component?.destroy();
            return;
          }

          if (!props.clientRect) {
            return;
          }

          popup?.[0]?.setProps({
            getBoundingClientRect: props.clientRect,
          });
        },
        onKeyDown: (props) => {
          if (props.event.key === keyMap.mentionPopup.close) {
            popup?.[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props.event) || false;
        },
        onExit: () => {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}
