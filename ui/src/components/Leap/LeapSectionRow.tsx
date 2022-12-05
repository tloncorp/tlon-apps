import React from 'react';
import LeapSection from './LeapSection';

export default function LeapRowSection({ section }: { section: LeapSection }) {
  return (
    <div
      className={`flex cursor-pointer items-center justify-between px-4 py-2 text-base text-gray-700 hover:bg-gray-100`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div>
            <p className="text-base font-semibold text-gray-900">
              {section.section}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
