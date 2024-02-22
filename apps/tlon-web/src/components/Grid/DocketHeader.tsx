import React from 'react';

import { getAppName } from '@/logic/utils';
import { DocketWithDesk } from '@/state/docket';

import DocketImage from './DocketImage';

interface DocketHeaderProps {
  docket: DocketWithDesk;
  children?: React.ReactNode;
}

export default function DocketHeader(props: DocketHeaderProps) {
  const { docket, children } = props;
  const { info, image, color } = docket;

  return (
    <header className="mb-5 grid grid-flow-row-dense auto-rows-min grid-cols-[5rem,1fr] gap-x-6 gap-y-4 sm:mb-8 md:grid-cols-[8rem,1fr]">
      <DocketImage
        color={color}
        image={image}
        className="row-span-1 md:row-span-2"
      />
      <div className="col-start-2">
        <h1 className="h2">{getAppName(docket)}</h1>
        {info && <p className="h4 mt-2 text-gray-500">{info}</p>}
      </div>
      {children}
    </header>
  );
}
