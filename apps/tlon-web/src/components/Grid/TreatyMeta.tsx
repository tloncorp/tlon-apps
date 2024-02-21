import { Treaty, daToDate } from '@urbit/api';
import moment from 'moment';
import React from 'react';

import Attribute from './Attribute';

const meta = ['license', 'website', 'version'] as const;

export default function TreatyMeta(props: { treaty: Treaty }) {
  const { treaty } = props;
  const { desk, ship, cass } = treaty;
  return (
    <div className="mt-5 space-y-5 sm:mt-8 sm:space-y-8">
      <Attribute title="Developer Desk" attr="desk">
        {ship}/{desk}
      </Attribute>
      <Attribute title="Last Software Update" attr="case">
        {moment(daToDate(cass.da)).format('YYYY.MM.DD')}
      </Attribute>
      {meta.map((d) => (
        <Attribute key={d} attr={d}>
          {treaty[d]}
        </Attribute>
      ))}
    </div>
  );
}
