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
  const [iconLetter, setIconLetter] = useState<string>();
  const [iconType, setIconType] = useState<ImageOrColorFieldState>('color');
  const [coverType, setCoverType] = useState<ImageOrColorFieldState>('color');
  const watchImage = watch('image');
  const watchTitle = watch('title');
  const watchCover = watch('cover');
  const showEmpty = iconType === 'image' && !isValidUrl(watchImage);
  const showCoverEmpty = coverType === 'image' && !isValidUrl(watchCover);
  const calm = useCalm();

  useEffect(() => {
    if (iconType === 'color' && watchTitle !== '') {
      setIconLetter((watchTitle as string).slice(0, 1));
    }
  }, [iconType, watchTitle]);

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
      <div className="flex space-x-2">
        <div>
          <GroupInfoPreview
            iconType={iconType}
            showEmpty={showEmpty}
            watchImage={watchImage}
            watchTitle={watchTitle}
            watchCover={watchCover}
            iconLetter={iconLetter}
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
