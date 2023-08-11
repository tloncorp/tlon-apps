import { useEffect, useState } from 'react';
import cn from 'classnames';
import { isImageUrl } from '@/logic/utils';
import Spinner from '@/components/Grid/Spinner';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

export default function MediaPreview({ url }: { url: string }) {
  const [ready, setReady] = useState(false);
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalHeight > image.naturalWidth) setPortrait(true);
      setReady(true);
    };
    image.src = url;
  }, [url]);

  if (!ready) {
    return <LoadingSpinner className="h-6 w-6" />;
  }

  if (isImageUrl(url)) {
    return (
      <img
        className={cn(
          'block rounded-lg object-contain',
          portrait ? 'h-[350px]' : 'w-full'
        )}
        src={url}
      />
    );
  }

  // TODO: add other cases

  return <div>Placeholder</div>;
}
