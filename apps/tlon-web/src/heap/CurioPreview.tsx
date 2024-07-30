import cn from 'classnames';
import { useEffect, useState } from 'react';
import isURL from 'validator/lib/isURL';

import TlonImage from '@/components/Image';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ContentReference from '@/components/References/ContentReference';
import { isImageUrl, isRef, pathToCite } from '@/logic/utils';

export function canPreview(text: string) {
  return (
    (isURL(text) && isImageUrl(text)) ||
    (isRef(text) && typeof pathToCite(text) !== 'undefined')
  );
}
export default function CurioPreview({ url }: { url: string }) {
  const [status, setStatus] = useState<'initial' | 'loading' | 'ready'>(
    'initial'
  );
  const [portrait, setPortrait] = useState(false);
  const isBlob = url.startsWith('blob:');

  useEffect(() => {
    if (isRef(url)) {
      setStatus('ready');
    }

    if (isImageUrl(url) || isBlob) {
      const image = new Image();
      image.onload = () => {
        if (image.naturalHeight > image.naturalWidth) setPortrait(true);
        setStatus('ready');
      };
      image.src = url;
    }
  }, [url, isBlob]);

  // delay spinner to avoid flash on local file
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (status === 'initial') setStatus('loading');
    }, 500);
    return () => clearTimeout(timeout);
  }, [status]);

  if (status === 'loading') {
    return <LoadingSpinner className="h-6 w-6" />;
  }

  if (isImageUrl(url) || isBlob) {
    return (
      <TlonImage
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
