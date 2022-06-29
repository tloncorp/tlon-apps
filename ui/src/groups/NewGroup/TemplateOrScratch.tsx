import React from 'react';

const TEMPLATE_TYPE: Record<
  string,
  { name: string; description: string; suggestedSize: string }
> = {
  small: {
    name: 'Small',
    description: 'Collaboration',
    suggestedSize: '1-10',
  },
  medium: {
    name: 'Medium',
    description: 'Collective',
    suggestedSize: '10-30',
  },
  large: {
    name: 'Large',
    description: 'Organization',
    suggestedSize: '30+',
  },
};

export default function TemplateOrScratch({
  next,
}: {
  next: (templateType?: string) => void;
}) {
  return (
    <>
      <div className="-mx-6 -mt-6 flex flex-col space-y-4 rounded-t-xl bg-gray-50 p-6">
        <div>
          <span className="text-lg font-bold">Create Group</span>
        </div>
        <div>
          <button className="button" onClick={() => next()}>
            Create Group from scratch
          </button>
        </div>
      </div>
      <div className="flex flex-col py-6">
        <span className="text-lg font-bold text-gray-600">
          or use a Template
        </span>
        <div className="flex flex-col">
          {Object.keys(TEMPLATE_TYPE).map((template) => (
            <div
              className="flex items-center justify-between py-2"
              key={TEMPLATE_TYPE[template].name}
            >
              <div className="flex flex-col">
                <span className="font-semibold">
                  {TEMPLATE_TYPE[template].name}
                </span>
                <span className="font-semibold text-gray-400">
                  {TEMPLATE_TYPE[template].description},{' '}
                  {TEMPLATE_TYPE[template].suggestedSize}
                </span>
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
    </>
  );
}
