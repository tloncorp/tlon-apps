import React from 'react';
import cn from 'classnames';
import { useFormContext } from 'react-hook-form';
import ColorBoxIcon from '@/components/icons/ColorBoxIcon';
import EmptyIconBox from '@/components/icons/EmptyIconBox';
import GroupAvatar from '@/groups/GroupAvatar';
import { isValidUrl } from '@/logic/utils';
import { ImageOrColorFieldState } from '@/components/ImageOrColorField';
import { GroupMeta } from '@/types/groups';

interface GroupInfoPreviewProps {
  iconType: ImageOrColorFieldState;
  showEmpty: boolean;
  watchImage: string;
  watchCover: string;
  watchTitle: string;
  iconLetter: string | undefined;
  coverType: ImageOrColorFieldState;
  showCoverEmpty: boolean;
}

export default function GroupInfoPreview({
  iconType,
  showEmpty,
  coverType,
  watchCover,
  watchTitle,
  watchImage,
  iconLetter,
  showCoverEmpty,
}: GroupInfoPreviewProps) {
  console.log(watchCover);
  return (
    <div
      className={cn(
        'relative flex h-32 w-32 items-end rounded-lg',
        showCoverEmpty && 'bg-gray-200'
      )}
      style={
        coverType === 'color' ? { backgroundColor: watchCover } : undefined
      }
    >
      {coverType === 'image' && isValidUrl(watchCover) ? (
        <img
          src={watchCover}
          alt="Group Cover Image"
          className="absolute h-full w-full flex-none rounded-lg object-cover"
        />
      ) : null}
      <div className="relative flex w-full flex-col justify-between p-2 text-lg sm:text-base">
        <div className="flex w-full items-center">
          {iconType === 'color' ? (
            <ColorBoxIcon
              className="h-6 w-6 text-lg"
              color={watchImage ? watchImage : '#000000'}
              letter={iconLetter ? iconLetter : 'T'}
            />
          ) : null}
          {iconType === 'image' && isValidUrl(watchImage) ? (
            <GroupAvatar size=" h-6 w-6" image={watchImage} />
          ) : null}
          {showEmpty ? (
            <EmptyIconBox className=" h-6 w-6 text-gray-300" />
          ) : null}
        </div>
        <div className="text-gray-500">{watchTitle}</div>
      </div>
    </div>
  );
}
