import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { getFlagParts } from '@/logic/utils';
import { useGroups } from '@/state/groups';
import GroupIcon from '../icons/GroupIcon';
import menuOptions from './MenuOptions';

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
        ) // TODO: fuzzy search
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
              group.meta.description.slice(0, 32) || getFlagParts(flag).ship,
            to: `/groups/${flag}`,
            resultIndex: idx,
          };
        }),
    ];
  }, [groups, inputValue, navigate]);

  const results = [...menu, ...groupResults];

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
