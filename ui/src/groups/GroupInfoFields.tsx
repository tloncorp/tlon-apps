import React, { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import ColorBoxIcon from '@/components/icons/ColorBoxIcon';
import EmptyIconBox from '@/components/icons/EmptyIconBox';
import ImageOrColorField, {
  ImageOrColorFieldState,
} from '@/components/ImageOrColorField';
import { useCalm } from '@/state/settings';
import { isValidUrl } from '@/logic/utils';
import { GroupMeta } from '@/types/groups';
import GroupAvatar from './GroupAvatar';

export default function GroupInfoFields() {
  const { register, watch } = useFormContext<GroupMeta>();
  const [iconLetter, setIconLetter] = useState<string>();
  const [iconType, setIconType] = useState<ImageOrColorFieldState>('initial');
  const watchImage = watch('image');
  const watchTitle = watch('title');
  const showEmpty =
    iconType === 'initial' || (iconType === 'image' && !isValidUrl(watchImage));
  const calm = useCalm();

  useEffect(() => {
    if (iconType === 'color' && watchTitle !== '') {
      setIconLetter((watchTitle as string).slice(0, 1));
    }
  }, [iconType, watchTitle]);

  return (
    <>
      <div className="flex">
        <div className="flex grow flex-col">
          <span className="pb-2 font-bold">Group Icon*</span>
          <ImageOrColorField
            fieldName="image"
            state={iconType}
            setState={setIconType}
          />
        </div>
        {iconType === 'color' ? (
          <ColorBoxIcon
            className="ml-2 h-14 w-14 text-xl"
            color={watchImage ? watchImage : '#000000'}
            letter={iconLetter ? iconLetter : 'T'}
          />
        ) : null}
        {iconType === 'image' && isValidUrl(watchImage) ? (
          <GroupAvatar size="ml-2 h-14 w-14" image={watchImage} />
        ) : null}
        {showEmpty ? (
          <EmptyIconBox className="ml-2 h-14 w-14 text-gray-300" />
        ) : null}
      </div>
      <div className="flex grow flex-col">
        <span className="pb-2 font-bold">Group Cover*</span>
        <ImageOrColorField fieldName="cover" />
      </div>
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
