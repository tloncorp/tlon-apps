import cn from 'classnames';
import React, { PropsWithChildren } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import useSidebarSort from '../../logic/useSidebarSort';
import {
  useGangList,
  useGroup,
  useGroupList,
  usePinnedGroups,
} from '../../state/groups';
import Divider from '../Divider';
import GangName from '../../groups/GangName/GangName';
import GroupAvatar from '../../groups/GroupAvatar';
import useNavStore from '../Nav/useNavStore';
import GroupActions from './GroupActions';
import SidebarItem from './SidebarItem';
import { useIsMobile } from '../../logic/useMedia';

const dragTypes = {
  GROUP: 'group',
};

function DraggableGroupItem({ flag }: { flag: string }) {
  const group = useGroup(flag);
  const navPrimary = useNavStore((state) => state.navigatePrimary);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: dragTypes.GROUP,
    item: { group },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div ref={drag} className={cn(isDragging ? 'opacity-0' : 'opacity-100')}>
      <SidebarItem
        icon={
          <GroupAvatar size="h-12 w-12 sm:h-6 sm:w-6" img={group?.meta.image} />
        }
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
      icon={
        <GroupAvatar size="h-12 w-12 sm:h-6 sm:w-6" img={group?.meta.image} />
      }
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
  const [{ isOver }, drop] = useDrop<
    { group: string },
    undefined,
    { isOver: boolean }
  >(
    () => ({
      accept: dragTypes.GROUP,
      drop: ({ group }) => {
        if (!group || group === flag) {
          return undefined;
        }
        console.log({ group });
        return undefined;
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    [flag]
  );

  return <div ref={drop}>{children}</div>;
}

// Gang is a pending group invite
function GangItem(props: { flag: string }) {
  const { flag } = props;
  const navPrimary = useNavStore((state) => state.navigatePrimary);
  return (
    <SidebarItem
      icon={<GroupAvatar size="h-12 w-12 sm:h-6 sm:w-6" />}
      to={`/gangs/${flag}`}
      onClick={() => navPrimary('hidden')}
    >
      <GangName flag={flag} className="inline-block w-full truncate" />
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
      <li className="flex items-center space-x-2 px-2 py-3">
        <span className="text-lg font-bold text-gray-400 lg:text-xs lg:font-semibold">
          Pinned
        </span>
        <div className="grow border-b-2 border-gray-100" />
      </li>
      {pinnedFlags.sort(sortOptions[sortFn]).map((flag) => (
        <GroupItemContainer flag={flag}>
          <DraggableGroupItem key={flag} flag={flag} />
        </GroupItemContainer>
      ))}
    </DndProvider>
  ) : (
    <ul className={cn('h-full space-y-3 p-2 sm:space-y-0', className)}>
      {flags
        .filter((flag) => !pinnedFlags.includes(flag))
        .sort(sortOptions[sortFn])
        .map((flag) => (
          <GroupItem key={flag} flag={flag} />
        ))}
      {gangs.length > 0 ? <Divider>Pending</Divider> : null}
      {gangs.map((flag) => (
        <GangItem key={flag} flag={flag} />
      ))}
    </ul>
  );
}
