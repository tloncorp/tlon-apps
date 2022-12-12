import React, { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import GroupInfoPreview from '@/groups/NewGroup/GroupInfoPreview';
import ImageOrColorField, {
  ImageOrColorFieldState,
} from '@/components/ImageOrColorField';
import { useCalm } from '@/state/settings';
import { isValidUrl } from '@/logic/utils';
import { GroupMeta } from '@/types/groups';

export default function GroupInfoFields() {
  const { register, watch } = useFormContext<GroupMeta>();
  const [iconType, setIconType] = useState<ImageOrColorFieldState>('color');
  const [coverType, setCoverType] = useState<ImageOrColorFieldState>('color');
  const watchImage = watch('image');
  const watchTitle = watch('title');
  const watchCover = watch('cover');
  const showEmpty = iconType === 'image' && !isValidUrl(watchImage);
  const showCoverEmpty = coverType === 'image' && !isValidUrl(watchCover);
  const calm = useCalm();

  return (
    <>
      <div className="flex flex-col">
        <label htmlFor="title" className="pb-2 font-bold">
          Group Name*
        </label>
        <input
          // TODO: set sane maxLength
          {...register('title', { required: true, maxLength: 180 })}
          className="input"
          type="text"
          placeholder="e.g. Urbit Fan Club"
        />
      </div>
      <div className="flex flex-col space-x-0 sm:flex-row sm:space-x-2">
        <div className="pb-2 font-bold sm:hidden">Preview</div>
        <div className="flex flex-row justify-center pb-2">
          <GroupInfoPreview
            iconType={iconType}
            showEmpty={showEmpty}
            watchImage={watchImage}
            watchTitle={watchTitle}
            watchCover={watchCover}
            coverType={coverType}
            showCoverEmpty={showCoverEmpty}
          />
        </div>
        <div className="flex grow flex-col">
          <span className="pb-2 font-bold">Group Icon*</span>
          <ImageOrColorField
            fieldName="image"
            state={iconType}
            setState={setIconType}
            defaultColor="#999999"
          />
          <span className="mt-4 pb-2 font-bold">Group Cover*</span>
          <ImageOrColorField
            fieldName="cover"
            state={coverType}
            setState={setCoverType}
            defaultColor="#D9D9D9"
          />
        </div>
      </div>
      <div className="flex flex-col">
        <label htmlFor="description" className="pb-2 font-bold">
          Group Description (optional)
        </label>
        <textarea
          // TODO: set sane maxLength
          {...register('description', { maxLength: 300 })}
          className="input"
          spellCheck={`${!calm.disableSpellcheck}`}
        />
      </div>
    </>
  );
}
