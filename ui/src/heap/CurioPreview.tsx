import { useEffect, useState } from 'react';
import cn from 'classnames';
import { isImageUrl, isRef, pathToCite } from '@/logic/utils';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ContentReference from '@/components/References/ContentReference';
import isURL from 'validator/lib/isURL';

export function canPreview(text: string) {
  return (
    (isURL(text) && isImageUrl(text)) ||
    (isRef(text) && typeof pathToCite(text) !== 'undefined')
  );
}
export default function CurioPreview({ url }: { url: string }) {
  const [ready, setReady] = useState(false);
  const [spin, setSpin] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const isBlob = url.startsWith('blob:');

  useEffect(() => {
    if (isRef(url)) {
      setReady(true);
    }

    if (isImageUrl(url) || isBlob) {
      const image = new Image();
      image.onload = () => {
        if (image.naturalHeight > image.naturalWidth) setPortrait(true);
        setReady(true);
        setSpin(false);
      };
      image.src = url;
    }
  }, [url, isBlob]);

  // delay spinner to avoid flash on local file
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!ready) setSpin(true);
    }, 500);
    return () => clearTimeout(timeout);
  }, [ready]);

  if (!ready && spin) {
    return <LoadingSpinner className="h-6 w-6" />;
  }

  if (isImageUrl(url) || isBlob) {
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

  if (isRef(url)) {
    const cite = pathToCite(url)!;
    return (
      <div className="max-h-[350px] w-full">
        <ContentReference cite={cite} />
      </div>
    );
  }

  return <div>Bad Preview</div>;
}
