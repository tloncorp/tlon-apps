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
    <div className="flex flex-col space-y-8">
      <div>
        <label htmlFor="title" className="block pb-1.5 font-bold">
          Group Name
        </label>
        <input
          {...register('title', { required: true, maxLength: 180 })}
          className="input w-full"
          type="text"
          placeholder="e.g. Urbit Fan Club"
        />
      </div>

      <div className="flex space-x-4">
        <div className="flex grow flex-col space-y-6">
          <div>
            <label htmlFor="image" className="block pb-1.5 font-bold">
              Group Icon
            </label>
            <ImageOrColorField
              fieldName="image"
              state={iconType}
              setState={setIconType}
              defaultColor="#999999"
            />
          </div>
          <div>
            <label htmlFor="cover" className="block pb-1.5 font-bold">
              Group Header Image
            </label>
            <ImageOrColorField
              fieldName="cover"
              state={coverType}
              setState={setCoverType}
              defaultColor="#D9D9D9"
            />
          </div>
        </div>
        <div className="shrink-0">
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
      </div>

      <div>
        <label htmlFor="description" className="block pb-1.5 font-bold">
          Group Description
        </label>
        <textarea
          {...register('description', { maxLength: 300 })}
          className="input h-24 w-full"
          spellCheck={`${!calm.disableSpellcheck}`}
        />
      </div>
    </div>
  );
}
