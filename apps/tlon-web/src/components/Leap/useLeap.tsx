import { Contact } from '@tloncorp/shared/dist/urbit/contact';
import { Club } from '@tloncorp/shared/dist/urbit/dms';
import { Group, GroupChannel } from '@tloncorp/shared/dist/urbit/groups';
import { cite, deSig, preSig } from '@urbit/api';
import fuzzy from 'fuzzy';
import { uniqBy } from 'lodash';
import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';

import {
  LEAP_DESCRIPTION_TRUNCATE_LENGTH,
  LEAP_RESULT_SCORE_THRESHOLD,
  LEAP_RESULT_TRUNCATE_SIZE,
} from '@/constants';
import { useCheckChannelUnread } from '@/logic/channel';
import useIsGroupUnread from '@/logic/useIsGroupUnread';
import { getFlagParts, nestToFlag } from '@/logic/utils';
import { useCheckDmUnread, useDms, useMultiDms } from '@/state/chat';
import { emptyContact, useContacts } from '@/state/contact';
import { ChargeWithDesk, useCharges } from '@/state/docket';
import { useGroupFlag, useGroups, usePinnedGroups } from '@/state/groups';
import { useMutuals } from '@/state/pals';
import { usePinnedChannels, usePinnedClubs } from '@/state/pins';

import useActiveTab from '../Sidebar/util';
import BubbleIcon from '../icons/BubbleIcon';
import GridIcon from '../icons/GridIcon';
import GroupIcon from '../icons/GroupIcon';
import NotebookIcon from '../icons/NotebookIcon';
import PeopleIcon from '../icons/PeopleIcon';
import PersonIcon from '../icons/PersonIcon';
import ShapesIcon from '../icons/ShapesIcon';
import UnknownAvatarIcon from '../icons/UnknownAvatarIcon';
import { menuOptions } from './MenuOptions';

interface LeapContext {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
}

const LeapContext = React.createContext({
  isOpen: false,
  setIsOpen: (_isOpen: boolean) => null,
  inputValue: '',
  setInputValue: (_inputValue: string) => null,
  selectedIndex: 0,
  setSelectedIndex: (_selectedIndex: number) => null,
} as LeapContext);

export function LeapProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const contextValue = useMemo(
    () => ({
      isOpen,
      setIsOpen,
      inputValue,
      setInputValue,
      selectedIndex,
      setSelectedIndex,
    }),
    [
      isOpen,
      setIsOpen,
      inputValue,
      setInputValue,
      selectedIndex,
      setSelectedIndex,
    ]
  );

  return (
    <LeapContext.Provider value={contextValue}>{children}</LeapContext.Provider>
  );
}

export default function useLeap() {
  const {
    isOpen,
    setIsOpen,
    inputValue,
    setInputValue,
    selectedIndex,
    setSelectedIndex,
  } = React.useContext(LeapContext);
  const navigate = useNavigate();
  const groups = useGroups();
  const currentGroupFlag = useGroupFlag();
  const { isGroupUnread } = useIsGroupUnread();
  const { isChannelUnread } = useCheckChannelUnread();
  const isDMUnread = useCheckDmUnread();
  const pinnedGroups = usePinnedGroups();
  const multiDms = useMultiDms();
  const pinnedMultiDms = usePinnedClubs();
  const pinnedChannels = usePinnedChannels();
  const contacts = useContacts();
  const dms = useDms();
  const charges = useCharges();
  const location = useLocation();
  const mutuals = useMutuals();
  const tab = useActiveTab();
  const preSiggedMutuals = useMemo(
    () => Object.keys(mutuals).map((m) => preSig(m)),
    [mutuals]
  );

  const menu =
    inputValue === ''
      ? menuOptions.map((o, idx) => ({
          ...o,
          onSelect: () => {
            if (o.title === 'Tlon') {
              window.open(`${window.location.origin}/apps/groups/`, '_blank');
            } else if (o.modal === true) {
              navigate(o.to, { state: { backgroundLocation: location } });
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
      if (isDMUnread(preSig(ship))) {
        newScore += 10;
      }

      // downrank comets significantly
      newScore = ship.length > 28 ? newScore * 0.25 : newScore;

      return newScore;
    };

    const allShips = uniqBy(
      Object.entries(contacts)
        .map(
          ([s, contact]) => [s, contact || emptyContact] as [string, Contact]
        )
        .concat(
          // accounting for ships not in contact store, but in DMs
          // this fix is temporary until we fix the contact store
          dms.map((ship) => [preSig(ship), { nickname: '' } as Contact])
        ),
      ([ship]) => ship
    );
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
          navigate(`/dm/${patp}`);
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
          to: `/dm/${patp}`,
          resultIndex: idx,
        };
      }),
    ];
  }, [
    contacts,
    inputValue,
    isDMUnread,
    navigate,
    preSiggedMutuals,
    dms,
    setInputValue,
    setIsOpen,
    setSelectedIndex,
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
      const isPinned = pinnedChannels.includes(nest);
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
        const [chType, _chFlag] = nestToFlag(nest);
        const loc = `/groups/${groupFlag}/channels/${nest}`;
        const nav = tab === 'messages' ? `/dm${loc}` : loc;
        const onSelect = () => {
          navigate(nav);
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
          to: nav,
          resultIndex:
            idx +
            (shipResults.length > LEAP_RESULT_TRUNCATE_SIZE
              ? LEAP_RESULT_TRUNCATE_SIZE
              : shipResults.length - 1),
        };
      }),
    ];
  }, [
    tab,
    currentGroupFlag,
    groups,
    inputValue,
    isChannelUnread,
    isGroupUnread,
    navigate,
    pinnedChannels,
    pinnedGroups,
    shipResults.length,
    setSelectedIndex,
    setInputValue,
    setIsOpen,
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
          navigate(path);
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
    channelResults.length,
    groups,
    inputValue,
    isGroupUnread,
    navigate,
    pinnedGroups,
    shipResults.length,
    setSelectedIndex,
    setInputValue,
    setIsOpen,
  ]);

  const multiDmResults = useMemo(() => {
    if (inputValue === '') {
      return [];
    }

    const scoreMultiDmResult = (
      entry: fuzzy.FilterResult<[string, Club]>
    ): number => {
      const { score, original } = entry;
      const [multiDmFlag] = original;

      let newScore = score;

      // pinned groups are strong signals
      const isPinned = multiDmFlag in pinnedMultiDms;
      if (isPinned) {
        newScore += 10;
      }

      // prefer unreads as well
      const isUnread = isDMUnread(multiDmFlag);
      if (isUnread) {
        newScore += 5;
      }

      return newScore;
    };

    const allMultiDms = Object.entries(multiDms);
    const normalizedQuery = inputValue.toLocaleLowerCase();
    const filteredMultiDms = fuzzy
      .filter(normalizedQuery, allMultiDms, {
        extract: ([_, g]) => `${g.meta.title} ${g.meta.description}`,
      })
      .filter((r) => scoreMultiDmResult(r) > LEAP_RESULT_SCORE_THRESHOLD)
      .sort((a, b) => {
        const scoreA = scoreMultiDmResult(a);
        const scoreB = scoreMultiDmResult(b);
        return scoreB - scoreA;
      })
      .map((r) => r.original);

    return [
      {
        section: 'Group DMs',
      },
      ...filteredMultiDms.map(([flag, multiDm], idx) => {
        const path = `/dm/${flag}`;
        const onSelect = () => {
          navigate(path);
          setSelectedIndex(0);
          setInputValue('');
          setIsOpen(false);
        };
        return {
          onSelect,
          icon: PeopleIcon,
          input: inputValue,
          title: multiDm.meta.title,
          subtitle: multiDm.meta.description,
          to: path,
          resultIndex:
            idx +
            (shipResults.length > LEAP_RESULT_TRUNCATE_SIZE
              ? LEAP_RESULT_TRUNCATE_SIZE
              : shipResults.length - 1) +
            (channelResults.length > LEAP_RESULT_TRUNCATE_SIZE
              ? LEAP_RESULT_TRUNCATE_SIZE
              : channelResults.length - 1) +
            (groupResults.length > LEAP_RESULT_TRUNCATE_SIZE
              ? LEAP_RESULT_TRUNCATE_SIZE
              : groupResults.length - 1),
        };
      }),
    ];
  }, [
    channelResults.length,
    inputValue,
    multiDms,
    navigate,
    pinnedMultiDms,
    shipResults.length,
    groupResults.length,
    isDMUnread,
    setSelectedIndex,
    setInputValue,
    setIsOpen,
  ]);

  const chargeResults = useMemo(() => {
    if (inputValue === '') {
      return [];
    }

    const scoreChargeResult = (
      entry: fuzzy.FilterResult<[string, ChargeWithDesk]>
    ): number => {
      const { score } = entry;
      const newScore = score;

      return newScore;
    };

    const allCharges = Object.entries(charges)
      .filter(([desk, _charge]) => desk !== window.desk)
      .filter(([desk, _charge]) => desk !== 'landscape');
    const normalizedQuery = inputValue.toLocaleLowerCase();
    const filteredCharges = fuzzy
      .filter(normalizedQuery, allCharges, {
        extract: ([_, c]) => `${c.title}`,
      })
      .filter((r) => scoreChargeResult(r) > LEAP_RESULT_SCORE_THRESHOLD)
      .sort((a, b) => {
        const scoreA = scoreChargeResult(a);
        const scoreB = scoreChargeResult(b);
        return scoreB - scoreA;
      })
      .map((r) => r.original);

    return [
      {
        section: 'Apps',
      },
      ...filteredCharges.map(([desk, charge], idx) => {
        const onSelect = () => {
          navigate(`/app/${desk}`, {
            state: { backgroundLocation: location },
          });
          setSelectedIndex(0);
          setInputValue('');
          setIsOpen(false);
        };

        return {
          onSelect,
          icon: GridIcon,
          input: inputValue,
          title: charge.title,
          subtitle: charge.info ?? '',
          to: `/app/${desk}`,
          resultIndex:
            idx +
            (shipResults.length > LEAP_RESULT_TRUNCATE_SIZE
              ? LEAP_RESULT_TRUNCATE_SIZE
              : shipResults.length - 1) +
            (channelResults.length > LEAP_RESULT_TRUNCATE_SIZE
              ? LEAP_RESULT_TRUNCATE_SIZE
              : channelResults.length - 1) +
            (groupResults.length > LEAP_RESULT_TRUNCATE_SIZE
              ? LEAP_RESULT_TRUNCATE_SIZE
              : groupResults.length - 1) +
            (multiDmResults.length > LEAP_RESULT_TRUNCATE_SIZE
              ? LEAP_RESULT_TRUNCATE_SIZE
              : multiDmResults.length - 1),
        };
      }),
    ];
  }, [
    channelResults.length,
    inputValue,
    charges,
    shipResults.length,
    groupResults.length,
    setSelectedIndex,
    setInputValue,
    setIsOpen,
    multiDmResults.length,
    navigate,
    location,
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
    ...(multiDmResults.length > 1
      ? multiDmResults.slice(0, LEAP_RESULT_TRUNCATE_SIZE + 1)
      : []), // +1 to account for section header
    ...(chargeResults.length > 1
      ? chargeResults.slice(0, LEAP_RESULT_TRUNCATE_SIZE + 1)
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
