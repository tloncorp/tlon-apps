import dotenv from 'dotenv';

import { addCustomEnabledLoggers } from '../debug';

dotenv.config({ path: __dirname + '/../../.env.test' });
const loggers = process.env.ENABLED_LOGGERS?.split(',') ?? [];

addCustomEnabledLoggers(loggers);
