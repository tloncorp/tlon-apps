import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { getFlagParts, nestToFlag } from '@/logic/utils';
import { useGroups } from '@/state/groups';
import ChannelIcon from '@/channels/ChannelIcon';
import { Group, GroupChannel } from '@/types/groups';
import {
  LEAP_DESCRIPTION_TRUNCATE_LENGTH,
  LEAP_RESULT_TRUNCATE_SIZE,
} from '@/constants';
import menuOptions from './MenuOptions';
import GroupIcon from '../icons/GroupIcon';

export default function useLeap() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const groups = useGroups();

  // TODO: use resultIndex for consumption in Leap results
  const menu =
    inputValue === ''
      ? menuOptions.map((o, idx) => ({
          ...o,
          onSelect: () => {
            navigate(o.to);
            setIsOpen(false);
            setSelectedIndex(0);
          },
          resultIndex: idx,
        }))
      : [];

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

    return [
      {
        section: 'Channels',
      },
      ...allChannels
        .filter(({ channel }) =>
          channel.meta.title.toLowerCase().includes(inputValue.toLowerCase())
        )
        .map(({ groupFlag, group, channel, nest }, idx) => {
          const [, chFlag] = nestToFlag(nest);
          const onSelect = () => {
            navigate(`/groups/${groupFlag}/channels/chat/${chFlag}`);
            setSelectedIndex(0);
            setInputValue('');
            setIsOpen(false);
          };
          return {
            onSelect,
            icon: ChannelIcon,
            title: channel.meta.title,
            subtitle:
              channel.meta.description.slice(
                0,
                LEAP_DESCRIPTION_TRUNCATE_LENGTH
              ) || group.meta.title,
            to: `/groups/${groupFlag}/channels/chat/${chFlag}`,
            resultIndex: idx,
          };
        }),
    ];
  }, [groups, inputValue, navigate]);

  const groupResults = useMemo(() => {
    if (inputValue === '') {
      return [];
    }

    return [
      {
        section: 'Groups',
      },
      ...Object.entries(groups)
        .filter(([_flag, group]) =>
          group.meta.title.toLowerCase().includes(inputValue.toLowerCase())
        )
        .map(([flag, group], idx) => {
          const onSelect = () => {
            navigate(`/groups/${flag}`);
            setSelectedIndex(0);
            setInputValue('');
            setIsOpen(false);
          };
          return {
            onSelect,
            icon: GroupIcon,
            title: group.meta.title,
            subtitle:
              group.meta.description.slice(
                0,
                LEAP_DESCRIPTION_TRUNCATE_LENGTH
              ) || getFlagParts(flag).ship,
            to: `/groups/${flag}`,
            resultIndex:
              idx + (channelResults.length > 0 ? channelResults.length - 1 : 0), // -1 for channel result Section header
          };
        }),
    ];
  }, [channelResults.length, groups, inputValue, navigate]);

  // If changing the order, update the resultIndex calculations above
  const results = [
    ...menu,
    ...(channelResults.length > 1
      ? channelResults.slice(0, LEAP_RESULT_TRUNCATE_SIZE + 1)
      : []), // +1 to account for section header
    ...(groupResults.length > 1
      ? groupResults.slice(0, LEAP_RESULT_TRUNCATE_SIZE + 1)
      : []),
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
