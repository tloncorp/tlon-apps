import React from 'react';

import LeapSection from './LeapSection';

export default function LeapRowSection({ section }: { section: LeapSection }) {
  return (
    <div
      className={`flex cursor-text items-center justify-between px-4 py-3 text-base text-gray-700`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div>
            <p className="text-base font-semibold text-gray-400">
              {section.section}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
