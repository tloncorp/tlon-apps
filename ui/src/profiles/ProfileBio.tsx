import React, { useState, useRef, useEffect } from 'react';
import cn from 'classnames';

interface ProfileBioProps {
  bio: string;
}

export default function ProfileBio({ bio }: ProfileBioProps) {
  const [truncateBio, setTruncateBio] = useState(true);
  const [showButton, setShowButton] = useState(true);
  const bioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shouldShowButton = (el: Element) => {
      const { clientHeight, scrollHeight } = el;
      return clientHeight !== scrollHeight;
    };

    const checkButtonAvailability = () => {
      if (bioRef.current) {
        const hadClampClass = bioRef.current.classList.contains('line-clamp-3');
        if (!hadClampClass) bioRef.current.classList.add('line-clamp-3');
        setShowButton(shouldShowButton(bioRef.current));
        if (!hadClampClass) bioRef.current.classList.remove('line-clamp-3');
      }
    };

    checkButtonAvailability();
  }, [bioRef]);

  const handleShowButtonClick = () => setTruncateBio(!truncateBio);

  return (
    <>
      <div
        ref={bioRef}
        className={cn(
          'mt-1 max-w-prose text-gray-600',
          truncateBio && 'line-clamp-3'
        )}
      >
        {bio}
      </div>
      {showButton && (
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
