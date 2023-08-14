import { Component, useEffect, useState } from 'react';
import { useValue } from 'react-cosmos/client';
import IconButton from '../IconButton';

const iconPromises = [
  import('../icons/AddBadgeIcon'),
  import('../icons/AddIcon'),
  import('../icons/AddPersonIcon'),
  import('../icons/AddReactIcon'),
  import('../icons/AppGroupsIcon'),
  import('../icons/ArchiveIcon'),
  import('../icons/ArrowNEIcon'),
  import('../icons/ArrowNWIcon'),
  import('../icons/BadgeIcon'),
  import('../icons/BellIcon'),
  import('../icons/BlockquoteIcon'),
  import('../icons/BoldIcon'),
  import('../icons/BranchIcon'),
  import('../icons/BubbleIcon'),
  import('../icons/BulletIcon'),
  import('../icons/CaretDownIcon'),
  import('../icons/CaretLeftIcon'),
  import('../icons/CaretRightIcon'),
  import('../icons/CheckIcon'),
  import('../icons/CodeBlockIcon'),
  import('../icons/CodeIcon'),
  import('../icons/CopyIcon'),
  import('../icons/DefaultGroupIcon'),
  import('../icons/DoubleCaretRightIcon'),
  import('../icons/EllipsisCircleIcon'),
  import('../icons/EllipsisIcon'),
  import('../icons/EmptyIconBox'),
  import('../icons/ExclamationPoint'),
  import('../icons/ExpandIcon'),
  import('../icons/FaceIcon'),
  import('../icons/GlobeIcon'),
  import('../icons/GridIcon'),
  import('../icons/GroupIcon'),
  import('../icons/HashIcon'),
  import('../icons/HomeIcon'),
  import('../icons/InviteIcon'),
  import('../icons/ItalicIcon'),
  import('../icons/KeyIcon'),
  import('../icons/LeaveIcon'),
  import('../icons/LinkIcon'),
  import('../icons/ListIcon'),
  import('../icons/LockIcon'),
  import('../icons/MagnifyingGlassIcon'),
  import('../icons/MenuIcon'),
  import('../icons/MusicLargeIcon'),
  import('../icons/NewMessageIcon'),
  import('../icons/NotebookIcon'),
  import('../icons/PencilSettingsIcon'),
  import('../icons/PeopleIcon'),
  import('../icons/PersonIcon'),
  import('../icons/PinIcon'),
  import('../icons/PrivateIcon'),
  import('../icons/ShapesIcon'),
  import('../icons/ShareIcon'),
  import('../icons/SixDotIcon'),
  import('../icons/SlidersIcon'),
  import('../icons/SortIcon'),
  import('../icons/SpinnerIcon'),
  import('../icons/StarIcon'),
  import('../icons/StrikeIcon'),
  import('../icons/TalkIcon'),
  import('../icons/TlonIcon'),
  import('../icons/TwitterIcon'),
  import('../icons/UnknownAvatarIcon'),
  import('../icons/XIcon'),
];

export default function IconButtonFixture() {
  const [{ showTooltip, tooltipText }] = useValue('Tooltip', {
    defaultValue: { showTooltip: true, tooltipText: 'Tooltip' },
  });
  const [isSmall] = useValue('Small', { defaultValue: false });
  const [iconComponents, setIconComponents] = useState<Component[]>([]);
  useEffect(() => {
    async function load() {
      const loadedIcons = await Promise.all(iconPromises);
      setIconComponents(loadedIcons.map((m) => m.default));
    }
    load();
  }, []);

  return (
    <div className={'wrap flex flex-wrap gap-2'}>
      {iconComponents.map((Icon, i) => (
        <IconButton
          small={isSmall}
          showTooltip={showTooltip}
          label={tooltipText}
          className="rounded border border-gray-100 bg-white"
          icon={<Icon className="h-6 w-6 text-gray-400" />}
          key={i}
        />
      ))}
    </div>
  );
}
