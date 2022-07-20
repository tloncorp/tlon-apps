import cn from 'classnames';
import React, { PropsWithChildren, useEffect } from 'react';
import { uniq, without } from 'lodash';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import useSidebarSort from '../../logic/useSidebarSort';
import {
  useGang,
  useGangList,
  useGroup,
  useGroupList,
  usePinnedGroups,
} from '../../state/groups/groups';
import Divider from '../Divider';
import GroupAvatar from '../../groups/GroupAvatar';
import useNavStore from '../Nav/useNavStore';
import GroupActions from '../../groups/GroupActions';
import SidebarItem from './SidebarItem';
import { useIsMobile } from '../../logic/useMedia';
import { SettingsState, useSettingsState } from '../../state/settings';

const dragTypes = {
  GROUP: 'group',
};

const selOrderedPins = (s: SettingsState) => ({
  order: s.groups.orderedGroupPins,
  loaded: s.loaded,
});

function DraggableGroupItem({ flag }: { flag: string }) {
  const group = useGroup(flag);
  const navPrimary = useNavStore((state) => state.navigatePrimary);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: dragTypes.GROUP,
    item: { flag },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className={cn(
        'absolute w-full',
        isDragging ? 'opacity-0' : 'opacity-100'
      )}
    >
      <SidebarItem
        div
        icon={<GroupAvatar size="h-12 w-12 sm:h-6 sm:w-6" {...group?.meta} />}
        actions={<GroupActions flag={flag} />}
        onClick={() => navPrimary('group', flag)}
      >
        {group?.meta.title}
      </SidebarItem>
    </div>
  );
}

function GroupItem({ flag }: { flag: string }) {
  const group = useGroup(flag);
  const navPrimary = useNavStore((state) => state.navigatePrimary);

  return (
    <SidebarItem
      icon={<GroupAvatar size="h-12 w-12 sm:h-6 sm:w-6" {...group?.meta} />}
      actions={<GroupActions flag={flag} />}
      onClick={() => navPrimary('group', flag)}
    >
      {group?.meta.title}
    </SidebarItem>
  );
}

function GroupItemContainer({
  flag,
  children,
}: PropsWithChildren<{ flag: string }>) {
  const { order } = useSettingsState(selOrderedPins);
  const [{ isOver }, drop] = useDrop<
    { flag: string },
    undefined,
    { isOver: boolean }
  >(
    () => ({
      accept: dragTypes.GROUP,
      drop: ({ flag: itemFlag }) => {
        if (!itemFlag || itemFlag === flag) {
          return undefined;
        }
        // [1, 2, 3, 4] 1 -> 3
        // [2, 3, 4]
        const beforeSlot = order.indexOf(itemFlag) < order.indexOf(flag);
        const orderWithoutOriginal = without(order, itemFlag);
        const slicePoint = orderWithoutOriginal.indexOf(flag);
        // [2, 3] [4]
        const left = orderWithoutOriginal.slice(
          0,
          beforeSlot ? slicePoint + 1 : slicePoint
        );
        const right = orderWithoutOriginal.slice(slicePoint);
        // concat([2, 3], [1], [4])
        const newOrder = uniq(left.concat([itemFlag], right));
        // [2, 3, 1, 4]
        useSettingsState
          .getState()
          .putEntry('groups', 'orderedGroupPins', newOrder);

        return undefined;
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    [flag]
  );

  return (
    <li
      ref={drop}
      className={cn(
        'relative flex h-16 w-full ring-4 sm:h-10',
        isOver && 'ring-blue-500',
        !isOver && 'ring-transparent'
      )}
    >
      {children}
    </li>
  );
}

// Gang is a pending group invite
function GangItem(props: { flag: string }) {
  const { flag } = props;
  const { preview, claim } = useGang(flag);

  if (!claim) {
    return null;
  }

  return (
    <SidebarItem
      icon={
        <GroupAvatar
          {...preview?.meta}
          size="h-12 w-12 sm:h-6 sm:w-6"
          className="opacity-60"
        />
      }
    >
      <span className="inline-block w-full truncate opacity-60">
        {preview ? preview.meta.title : flag}
      </span>
    </SidebarItem>
  );
}

interface GroupListProps {
  className?: string;
  pinned?: boolean;
}

export default function GroupList({
  className,
  pinned = false,
}: GroupListProps) {
  const isMobile = useIsMobile();
  const flags = useGroupList();
  const pinnedFlags = usePinnedGroups();
  const gangs = useGangList();
  const { sortFn, sortOptions } = useSidebarSort();
  const { order, loaded } = useSettingsState(selOrderedPins);

  useEffect(() => {
    const hasKeys = order && !!order.length;
    const pinnedKeys = Object.keys(pinnedFlags);
    const hasPinnedKeys = pinnedKeys.length > 0;

    if (!loaded) {
      return;
    }

    // Correct order state, fill if none, remove duplicates, and remove
    // old uninstalled app keys
    if (!hasKeys && hasPinnedKeys) {
      useSettingsState
        .getState()
        .putEntry('groups', 'orderedGroupPins', pinnedKeys);
    } else if (order.length < pinnedKeys.length) {
      useSettingsState
        .getState()
        .putEntry('groups', 'orderedGroupPins', uniq(order.concat(pinnedKeys)));
    } else if (order.length > pinnedKeys.length && hasPinnedKeys) {
      useSettingsState
        .getState()
        .putEntry(
          'groups',
          'orderedGroupPins',
          uniq(order.filter((key) => key in pinnedFlags).concat(pinnedKeys))
        );
    }
  }, [pinnedFlags, order, loaded]);

  return pinned ? (
    <DndProvider
      backend={isMobile ? TouchBackend : HTML5Backend}
      options={
        isMobile
          ? {
              delay: 50,
              scrollAngleRanges: [
                { start: 30, end: 150 },
                { start: 210, end: 330 },
              ],
            }
          : undefined
      }
    >
      <li className="-mb-2 flex items-center sm:m-0 md:pr-2">
        <Divider>Pinned</Divider>
        <div className="grow border-b-2 border-gray-100" />
      </li>
      {pinnedFlags.sort(sortOptions[sortFn]).map((flag) => (
        <GroupItemContainer flag={flag} key={flag}>
          <DraggableGroupItem flag={flag} />
        </GroupItemContainer>
      ))}
    </DndProvider>
  ) : (
    <ul className={cn('h-full space-y-3 p-2 sm:space-y-0', className)}>
      {gangs.map((flag) => (
        <GangItem key={flag} flag={flag} />
      ))}
      {flags
        .filter((flag) => !pinnedFlags.includes(flag))
        .sort(sortOptions[sortFn])
        .map((flag) => (
          <GroupItem key={flag} flag={flag} />
        ))}
    </ul>
  );
}
