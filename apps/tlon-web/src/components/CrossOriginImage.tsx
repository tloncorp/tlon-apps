import React, {forwardRef} from 'react';

const CrossOriginImage = forwardRef(({
  src,
  alt,
  className,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement>) => {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      crossOrigin="anonymous"
      {...rest}
    />
  );
});

CrossOriginImage.displayName = 'CrossOriginImage';

export default CrossOriginImage;
