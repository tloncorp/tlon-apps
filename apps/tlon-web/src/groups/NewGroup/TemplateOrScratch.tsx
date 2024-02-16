import React from 'react';

import ColorBoxIcon from '@/components/icons/ColorBoxIcon';

interface TemplateOrScratchProps {
  next: (templateType?: string) => void;
}

const TEMPLATE_TYPE: Record<
  string,
  {
    name: string;
    description: string;
    suggestedSize: string;
    iconColor: string;
  }
> = {
  small: {
    name: 'Small',
    description: 'Collaboration',
    suggestedSize: '1-10',
    iconColor: '#2AD546',
  },
  medium: {
    name: 'Medium',
    description: 'Collective',
    suggestedSize: '10-30',
    iconColor: '#666666',
  },
  large: {
    name: 'Large',
    description: 'Organization',
    suggestedSize: '30+',
    iconColor: '#FADE7A',
  },
};

export default function TemplateOrScratch({ next }: TemplateOrScratchProps) {
  return (
    <div>
      <div className="-mx-6 -mt-6 flex flex-col space-y-4 rounded-t-xl bg-gray-50 p-6">
        <div>
          <span className="text-lg font-bold">Create Group</span>
        </div>
        <div>
          <button className="button" onClick={() => next()}>
            Create Group from Scratch
          </button>
        </div>
      </div>
      <div className="flex flex-col space-y-4 pt-6">
        <span className="text-lg font-bold text-gray-600">
          or use a Template
        </span>
        <div className="flex flex-col">
          {Object.keys(TEMPLATE_TYPE).map((template) => (
            <div
              className="flex items-center justify-between p-2"
              key={TEMPLATE_TYPE[template].name}
            >
              <div className="flex items-center space-x-2">
                <ColorBoxIcon
                  className="h-12 w-12 text-xl"
                  color={TEMPLATE_TYPE[template].iconColor}
                  letter="Aa"
                />
                <div className="flex flex-col space-y-2">
                  <span className="font-semibold">
                    {TEMPLATE_TYPE[template].name}
                  </span>
                  <span className="font-semibold text-gray-400">
                    {TEMPLATE_TYPE[template].description},{' '}
                    {TEMPLATE_TYPE[template].suggestedSize}
                  </span>
                </div>
              </div>
              <button
                className="small-button bg-blue"
                onClick={() => next(template)}
              >
                Create
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
