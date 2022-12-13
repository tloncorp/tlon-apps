import React from 'react';
import cn from 'classnames';
import ColorBoxIcon from '@/components/icons/ColorBoxIcon';
import EmptyIconBox from '@/components/icons/EmptyIconBox';
import GroupAvatar from '@/groups/GroupAvatar';
import { isValidUrl } from '@/logic/utils';
import { ImageOrColorFieldState } from '@/components/ImageOrColorField';

interface GroupInfoPreviewProps {
  iconType: ImageOrColorFieldState;
  showEmpty: boolean;
  watchImage: string;
  watchCover: string;
  watchTitle: string;
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
  showCoverEmpty,
}: GroupInfoPreviewProps) {
  return (
    <div
      className={cn(
        'relative flex h-32 w-32 items-end rounded-lg',
        showCoverEmpty && 'bg-gray-200'
      )}
      style={
        coverType === 'color'
          ? { backgroundColor: watchCover ? watchCover : '#D9D9D9' }
          : undefined
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
        <div className="flex items-center space-x-2">
          <div className="flex items-center">
            {iconType === 'color' || isValidUrl(watchImage) ? (
              <GroupAvatar
                title={watchTitle}
                size=" h-6 w-6"
                image={watchImage}
              />
            ) : null}
            {showEmpty ? (
              <EmptyIconBox className=" h-6 w-6 text-gray-300" />
            ) : null}
          </div>
          <div className="w-full truncate text-left font-semibold text-gray-500">
            {watchTitle}
          </div>
        </div>
      </div>
    </div>
  );
}
