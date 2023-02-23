import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { cite, Contact, deSig, preSig } from '@urbit/api';
import fuzzy from 'fuzzy';
import { getFlagParts, nestToFlag } from '@/logic/utils';
import { useGroupFlag, useGroups } from '@/state/groups';
import { Group, GroupChannel } from '@/types/groups';
import {
  LEAP_DESCRIPTION_TRUNCATE_LENGTH,
  LEAP_RESULT_SCORE_THRESHOLD,
  LEAP_RESULT_TRUNCATE_SIZE,
} from '@/constants';
import { useContacts } from '@/state/contact';
import { useModalNavigate } from '@/logic/routing';
import useAppName from '@/logic/useAppName';
import { usePinned, usePinnedGroups } from '@/state/chat';
import useIsGroupUnread from '@/logic/useIsGroupUnread';
import { useCheckChannelUnread } from '@/logic/useIsChannelUnread';
import { useMutuals } from '@/state/pals';
import { groupsMenuOptions, talkMenuOptions } from './MenuOptions';
import GroupIcon from '../icons/GroupIcon';
import PersonIcon from '../icons/PersonIcon';
import UnknownAvatarIcon from '../icons/UnknownAvatarIcon';
import BubbleIcon from '../icons/BubbleIcon';
import ShapesIcon from '../icons/ShapesIcon';
import NotebookIcon from '../icons/NotebookIcon';

export default function useLeap() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const modalNavigate = useModalNavigate();
  const groups = useGroups();
  const currentGroupFlag = useGroupFlag();
  const { isGroupUnread } = useIsGroupUnread();
  const isChannelUnread = useCheckChannelUnread();
  const pinnedGroups = usePinnedGroups();
  const pinnedChats = usePinned();
  const contacts = useContacts();
  const location = useLocation();
  const app = useAppName();
  const mutuals = useMutuals();
  const preSiggedMutuals = useMemo(
    () => Object.keys(mutuals).map((m) => preSig(m)),
    [mutuals]
  );
  const menuOptions = app === 'Talk' ? talkMenuOptions : groupsMenuOptions;

  const menu =
    inputValue === ''
      ? menuOptions.map((o, idx) => ({
          ...o,
          onSelect: () => {
            if (app === 'Groups' && o.title === 'Messages') {
              window.open(`${window.location.origin}/apps/talk`, '_blank');
            } else if (app === 'Groups' && o.title === 'Create New Group') {
              modalNavigate(`/groups/new`, {
                state: { backgroundLocation: location },
              });
            } else if (app === 'Talk' && o.title === 'Groups') {
              window.open(
                `${window.location.origin}/apps/groups/find`,
                '_blank'
              );
            } else {
              navigate(o.to);
            }
            setIsOpen(false);
            setSelectedIndex(0);
          },
          resultIndex: idx,
        }))
      : [];

  const shipResults = useMemo(() => {
    if (inputValue === '') {
      return [];
    }

    const scoreShipResult = (
      filter: string,
      entry: fuzzy.FilterResult<[string, Contact]>
    ): number => {
      const parts = entry.string.split('~');
      let newScore = entry.score;

      // shouldn't happen
      if (parts.length === 1) {
        return newScore;
      }

      const [nickname, ship] = parts;

      // console.log('ship', ship, 'score', newScore);

      // boost mutuals significantly
      if (preSiggedMutuals.includes(preSig(ship))) {
        newScore += 10;
      }

      // making this highest because ships are unique, nicknames are not
      // also prevents someone setting their nickname as someone else's
      // patp taking over prime position
      if (ship === filter) {
        newScore += 12;
      }

      if (nickname === filter) {
        newScore += 10;
      }

      // since ship is in the middle of the string we need to make it work
      // as if it was at the beginning
      if (nickname && ship.startsWith(filter)) {
        newScore += 8;
      }

      // boost ships that have unread DMs
      if (isChannelUnread(preSig(ship))) {
        newScore += 10;
      }

      // downrank comets significantly
      newScore = ship.length > 28 ? newScore * 0.25 : newScore;

      return newScore;
    };

    const allShips = Object.entries(contacts);
    const normalizedQuery = inputValue.toLocaleLowerCase();
    const filteredShips = fuzzy
      .filter(normalizedQuery, allShips, {
        extract: ([whom, contact]) => `${whom}${contact.nickname}`,
      })
      .filter(
        (r) => scoreShipResult(normalizedQuery, r) > LEAP_RESULT_SCORE_THRESHOLD
      )
      .sort((a, b) => {
        const filter = deSig(normalizedQuery) || '';
        const scoreA = scoreShipResult(filter, a);
        const scoreB = scoreShipResult(filter, b);
        return scoreB - scoreA;
      })
      .map((r) => r.original);

    return [
      {
        section: 'Ships',
      },
      ...filteredShips.map(([patp, contact], idx) => {
        const onSelect = () => {
          if (app === 'Talk') {
            navigate(`/dm/${patp}`);
          } else {
            modalNavigate(`/profile/${patp}`, {
              state: { backgroundLocation: location },
            });
          }
          setSelectedIndex(0);
          setInputValue('');
          setIsOpen(false);
        };
        return {
          onSelect,
          icon: PersonIcon,
          input: inputValue,
          title: contact.nickname
            ? `${contact.nickname} (${cite(patp)})`
            : cite(patp),
          subtitle: (contact.status || contact.bio || '').slice(
            0,
            LEAP_DESCRIPTION_TRUNCATE_LENGTH
          ),
          to: `/profile/${patp}`,
          resultIndex: idx,
        };
      }),
    ];
  }, [
    app,
    contacts,
    inputValue,
    isChannelUnread,
    location,
    modalNavigate,
    navigate,
    preSiggedMutuals,
  ]);

  const channelResults = useMemo(() => {
    if (inputValue === '') {
      return [];
    }

    const allChannels = Object.entries(groups).reduce(
      (memo, [groupFlag, group]) =>
        [
          ...memo,
          Object.entries(group.channels).map(([nest, channel]) => ({
            groupFlag,
            group,
            nest,
            channel,
          })),
        ].flat(),
      [] as {
        groupFlag: string;
        group: Group;
        nest: string;
        channel: GroupChannel;
      }[]
    );

    const scoreChannelResult = (
      entry: fuzzy.FilterResult<{
        groupFlag: string;
        group: Group;
        nest: string;
        channel: GroupChannel;
      }>
    ): number => {
      const { score, original } = entry;
      const { nest, groupFlag } = original;

      let newScore = score;

      // pinned channels are strong signals
      const isPinned = pinnedChats.includes(nest);
      if (isPinned) {
        newScore += 8;
      }

      // so are unread channels
      const isUnreadChannel = isChannelUnread(nest);
      if (isUnreadChannel) {
        newScore += 7;
      }

      // so is if the channel we're looking for is within the current group that we're in
      const isCurrentGroup = groupFlag === currentGroupFlag;
      if (isCurrentGroup) {
        newScore += 6;
      }

      // so are channels within pinned groups, but less so
      const isGroupPinned = groupFlag in pinnedGroups;
      if (isGroupPinned) {
        newScore += 4;
      }

      // so are unread groups, but just a little
      const isUnreadGroup = isGroupUnread(groupFlag);
      if (isUnreadGroup) {
        newScore += 2;
      }

      return newScore;
    };

    const normalizedQuery = inputValue.toLocaleLowerCase();
    const filteredChannels = fuzzy
      .filter(normalizedQuery, allChannels, {
        extract: (c) => `${c.channel.meta.title}`,
      })
      .filter((r) => scoreChannelResult(r) > LEAP_RESULT_SCORE_THRESHOLD)
      .sort((a, b) => {
        const scoreA = scoreChannelResult(a);
        const scoreB = scoreChannelResult(b);
        return scoreB - scoreA;
      })
      .map((r) => r.original);

    return [
      {
        section: 'Channels',
      },
      ...filteredChannels.map(({ groupFlag, group, channel, nest }, idx) => {
        const [chType, chFlag] = nestToFlag(nest);
        const onSelect = () => {
          navigate(`/groups/${groupFlag}/channels/${nest}`);
          setSelectedIndex(0);
          setInputValue('');
          setIsOpen(false);
        };
        let channelIcon;
        switch (chType) {
          case 'chat':
            channelIcon = BubbleIcon;
            break;
          case 'heap':
            channelIcon = ShapesIcon;
            break;
          case 'diary':
            channelIcon = NotebookIcon;
            break;
          default:
            channelIcon = UnknownAvatarIcon;
        }
        return {
          onSelect,
          icon: channelIcon,
          input: inputValue,
          title: channel.meta.title,
          subtitle: group.meta.title,
          to: `/groups/${groupFlag}/channels/chat/${chFlag}`,
          resultIndex:
            idx +
            (shipResults.length > LEAP_RESULT_TRUNCATE_SIZE
              ? LEAP_RESULT_TRUNCATE_SIZE
              : shipResults.length - 1),
        };
      }),
    ];
  }, [
    currentGroupFlag,
    groups,
    inputValue,
    isChannelUnread,
    isGroupUnread,
    navigate,
    pinnedChats,
    pinnedGroups,
    shipResults.length,
  ]);

  const groupResults = useMemo(() => {
    if (inputValue === '') {
      return [];
    }

    const scoreGroupResult = (
      entry: fuzzy.FilterResult<[string, Group]>
    ): number => {
      const { score, original } = entry;
      const [groupFlag] = original;

      let newScore = score;

      // pinned groups are strong signals
      const isPinned = groupFlag in pinnedGroups;
      if (isPinned) {
        newScore += 10;
      }

      // prefer unreads as well
      const isUnread = isGroupUnread(groupFlag);
      if (isUnread) {
        newScore += 5;
      }

      return newScore;
    };

    const allGroups = Object.entries(groups);
    const normalizedQuery = inputValue.toLocaleLowerCase();
    const filteredGroups = fuzzy
      .filter(normalizedQuery, allGroups, {
        extract: ([_, g]) => `${g.meta.title} ${g.meta.description}`,
      })
      .filter((r) => scoreGroupResult(r) > LEAP_RESULT_SCORE_THRESHOLD)
      .sort((a, b) => {
        const scoreA = scoreGroupResult(a);
        const scoreB = scoreGroupResult(b);
        return scoreB - scoreA;
      })
      .map((r) => r.original);

    return [
      {
        section: 'Groups',
      },
      ...filteredGroups.map(([flag, group], idx) => {
        const path = `/groups/${flag}`;
        const onSelect = () => {
          if (app === 'Talk') {
            window.open(
              `${window.location.origin}/apps/groups${path}`,
              '_blank'
            );
          } else {
            navigate(path);
          }
          setSelectedIndex(0);
          setInputValue('');
          setIsOpen(false);
        };
        return {
          onSelect,
          icon: GroupIcon,
          input: inputValue,
          title: group.meta.title,
          subtitle:
            group.meta.description.slice(0, LEAP_DESCRIPTION_TRUNCATE_LENGTH) ||
            getFlagParts(flag).ship,
          to: path,
          resultIndex:
            idx +
            (shipResults.length > LEAP_RESULT_TRUNCATE_SIZE
              ? LEAP_RESULT_TRUNCATE_SIZE
              : shipResults.length - 1) +
            (channelResults.length > LEAP_RESULT_TRUNCATE_SIZE
              ? LEAP_RESULT_TRUNCATE_SIZE
              : channelResults.length - 1),
        };
      }),
    ];
  }, [
    app,
    channelResults.length,
    groups,
    inputValue,
    isGroupUnread,
    navigate,
    pinnedGroups,
    shipResults.length,
  ]);

  // If changing the order, update the resultIndex calculations above
  const results = [
    ...menu,
    ...(shipResults.length > 1
      ? shipResults.slice(0, LEAP_RESULT_TRUNCATE_SIZE + 1)
      : []), // +1 to account for section header
    ...(channelResults.length > 1
      ? channelResults.slice(0, LEAP_RESULT_TRUNCATE_SIZE + 1)
      : []), // +1 to account for section header
    ...(groupResults.length > 1
      ? groupResults.slice(0, LEAP_RESULT_TRUNCATE_SIZE + 1)
      : []), // +1 to account for section header
  ];

  return {
    isOpen,
    setIsOpen,
    inputValue,
    setInputValue,
    selectedIndex,
    setSelectedIndex,
    results,
    resultCount: results.filter((r) => !('section' in r)).length, // count only non-section results
  };
}
