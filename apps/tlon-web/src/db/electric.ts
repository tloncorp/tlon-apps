import { makeElectricContext } from 'electric-sql/react';
import { ElectricDatabase, electrify } from 'electric-sql/wa-sqlite';

import { Electric, schema } from './generated';

const dbName = `tlon-electric-sqlite.db`;
const conn = await ElectricDatabase.init(dbName);

// Instantiate your electric client.
const electric = await electrify(conn, schema);

const { ElectricProvider, useElectric } = makeElectricContext<Electric>();

export { ElectricProvider, useElectric };

export default electric;
