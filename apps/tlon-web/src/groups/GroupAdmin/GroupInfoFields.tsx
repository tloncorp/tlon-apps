import ImageOrColorField, {
  ImageOrColorFieldState,
} from '@/components/ImageOrColorField';
import GroupInfoPreview from '@/groups/NewGroup/GroupInfoPreview';
import { useIsMobile } from '@/logic/useMedia';
import { isValidUrl } from '@/logic/utils';
import { useCalm } from '@/state/settings';
import { GroupMeta } from '@/types/groups';
import cn from 'classnames';
import React, { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

export default function GroupInfoFields() {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<GroupMeta>();
  const [iconType, setIconType] = useState<ImageOrColorFieldState>('color');
  const [coverType, setCoverType] = useState<ImageOrColorFieldState>('color');
  const [watchImage, watchTitle, watchCover, watchDescription] = watch([
    'image',
    'title',
    'cover',
    'description',
  ]);
  const showEmpty = iconType === 'image' && !isValidUrl(watchImage);
  const showCoverEmpty = coverType === 'image' && !isValidUrl(watchCover);
  const calm = useCalm();
  const isMobile = useIsMobile();

  function renderGroupIconInfo() {
    return (
      <div>
        <label htmlFor="image" className="block pb-1.5 font-semibold">
          Group Icon
        </label>
        <ImageOrColorField
          fieldName="image"
          state={iconType}
          setState={setIconType}
          defaultColor="#999999"
        />
      </div>
    );
  }

  function renderGroupHeaderInfo() {
    return (
      <div>
        <label htmlFor="cover" className="block pb-1.5 font-semibold">
          Group Header Image
        </label>
        <ImageOrColorField
          fieldName="cover"
          state={coverType}
          setState={setCoverType}
          defaultColor="#D9D9D9"
        />
      </div>
    );
  }

  function renderGroupInfoPreview() {
    return (
      <GroupInfoPreview
        iconType={iconType}
        showEmpty={showEmpty}
        watchImage={watchImage}
        watchTitle={watchTitle}
        watchCover={watchCover}
        coverType={coverType}
        showCoverEmpty={showCoverEmpty}
      />
    );
  }

  return (
    <div className="flex flex-col space-y-8">
      <div>
        <label htmlFor="title" className="block pb-1.5 font-semibold">
          Group Name
        </label>
        <input
          {...register('title', { required: true, maxLength: 180 })}
          className="input w-full"
          type="text"
          placeholder="e.g. Urbit Fan Club"
          tabIndex={-1}
        />
      </div>

      {isMobile ? (
        <div className="flex grow flex-col space-y-6">
          {renderGroupIconInfo()}
          {renderGroupHeaderInfo()}
        </div>
      ) : (
        <div className="flex space-x-4">
          <div className="flex grow flex-col space-y-6">
            {renderGroupIconInfo()}
            {renderGroupHeaderInfo()}
          </div>
          <div className="shrink-0">{renderGroupInfoPreview()}</div>
        </div>
      )}
      <div className="space-y-1.5">
        <label
          htmlFor="description"
          className={cn(
            'block font-bold transition-colors',
            errors.description && 'text-red-500'
          )}
        >
          Group Description
        </label>
        <textarea
          {...register('description', { maxLength: 300 })}
          className={cn(
            'input h-24 w-full',
            errors.description &&
              'border-red-500/50 focus-within:border-red-500/50 focus-visible:border-red-500/50'
          )}
          spellCheck={`${!calm.disableSpellcheck}`}
        />
        <div
          className={cn(
            'text-right text-sm text-gray-500 transition-colors',
            errors.description && 'text-red-500'
          )}
        >
          {watchDescription.length}/300
        </div>
      </div>
    </div>
  );
}
