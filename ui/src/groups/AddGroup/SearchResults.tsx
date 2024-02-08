import cn from 'classnames';
import { Gang } from '@/types/groups';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import { useGang, useGroup } from '@/state/groups';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import GroupAvatar from '../GroupAvatar';

export function GroupResultRow({
  flag,
  size,
  onClick,
}: {
  flag: string;
  size: 'mobile' | 'desktop';
  onClick: () => void;
}) {
  const gang: Gang = useGang(flag);
  const group = useGroup(flag);
  const meta = group ? group.meta : gang.preview && gang.preview.meta;
  const privacy = useGroupPrivacy(flag);

  return (
    <SidebarItem
      onClick={onClick}
      icon={
        <GroupAvatar
          {...gang.preview?.meta}
          className="flex-none"
          size={size === 'mobile' ? 'h-6 w-6 rounded' : 'h-12 w-12 rounded-lg'}
        />
      }
    >
      <div className="flex flex-col justify-center">
        <div className="flex w-full items-center justify-between">
          <h2>{meta?.title || flag}</h2>
          <div className="flex-start flex w-[45px]">
            <p className="text-sm capitalize text-gray-300">
              {privacy.privacy}
            </p>
          </div>
        </div>
        {meta?.description && (
          <p className="line-clamp-1 pr-12 text-sm font-normal text-gray-400 sm:mt-1">
            {meta.description}
          </p>
        )}
      </div>
    </SidebarItem>
  );
}

export function ShipResultRow({
  patp,
  nickname,
  onClick,
}: {
  patp: string;
  nickname: string;
  onClick: () => void;
}) {
  return (
    <div onClick={onClick} className="flex items-center">
      <Avatar ship={patp} size="default-sm" className="mr-4" />
      <div className="flex">
        <ShipName name={patp} showAlias />
        {nickname && nickname !== patp && (
          <ShipName name={patp} className="ml-2 text-sm text-gray-300" />
        )}
      </div>
    </div>
  );
}

export function ShipSearchResultsDisplay({
  searchResults,
  select,
}: {
  searchResults: { value: string; label: string }[];
  select: (patp: string, nickname: string) => void;
}) {
  if (searchResults.length === 0) {
    return (
      <div className="mt-3 flex h-[200px] w-full items-center justify-center">
        <h3 className="text-lg text-gray-400">No hosts found.</h3>
      </div>
    );
  }

  return (
    <div className="mt-3 h-[200px] w-full overflow-auto">
      {searchResults.map(({ value, label }) => (
        <div className="mt-4" key={value}>
          <ShipResultRow
            patp={value}
            nickname={label}
            onClick={() => select(value, label)}
          />
        </div>
      ))}
    </div>
  );
}

export function ShipGroupsDisplay({
  flags,
  hostMayBeOffline,
  loading,
  autoHeight,
  selectGroup,
  size = 'mobile',
}: {
  flags: string[];
  loading: boolean;
  autoHeight?: boolean;
  hostMayBeOffline?: boolean;
  size?: 'mobile' | 'desktop';
  selectGroup: (flag: string) => void;
}) {
  if (loading) {
    return (
      <div
        className={cn(
          'mt-3 flex w-full items-center justify-center',
          autoHeight ?? 'h-[200px]'
        )}
      >
        <LoadingSpinner className="h-6 w-6" />
      </div>
    );
  }

  if (flags.length === 0) {
    return (
      <div
        className={cn(
          'mt-3 flex w-full flex-col items-center justify-center',
          autoHeight ?? 'h-[200px]'
        )}
      >
        <h3 className="text-lg text-gray-400">No groups found</h3>
        {hostMayBeOffline && (
          <p className="mt-1 text-sm text-gray-300">The host may be offline.</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mt-3 max-h-full w-full overflow-auto',
        autoHeight ?? 'h-[200px]'
      )}
    >
      {flags.map((flag) => (
        <GroupResultRow
          flag={flag}
          key={flag}
          onClick={() => selectGroup(flag)}
          size={size}
        />
      ))}
    </div>
  );
}
