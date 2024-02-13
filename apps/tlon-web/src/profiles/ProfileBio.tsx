import cn from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

interface ProfileBioProps {
  bio: string;
}

export default function ProfileBio({ bio }: ProfileBioProps) {
  const [truncateBio, setTruncateBio] = useState(true);
  const [showButton, setShowButton] = useState(true);
  const bioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bioRef.current) {
      const { clientHeight, scrollHeight } = bioRef.current;
      setShowButton(clientHeight !== scrollHeight);
    }
  }, []);

  const handleShowButtonClick = () => setTruncateBio(!truncateBio);

  return (
    <>
      <div
        ref={bioRef}
        className={cn(
          'mt-1 max-w-prose leading-tight text-gray-600',
          truncateBio && 'line-clamp-3'
        )}
      >
        {bio}
      </div>
      {(showButton || !truncateBio) && (
        <button
          onClick={handleShowButtonClick}
          className="small-secondary-button mt-2"
        >
          {truncateBio ? 'Expand Bio' : 'Collapse Bio'}
        </button>
      )}
    </>
  );
}
