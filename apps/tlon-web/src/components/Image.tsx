import React, { forwardRef } from 'react';

const Image = forwardRef(
  ({
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
  }
);

Image.displayName = 'Image';

export default Image;
