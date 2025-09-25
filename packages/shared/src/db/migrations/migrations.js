// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_panoramic_xorn.sql';
import m0001 from './0001_curly_menace.sql';
import m0002 from './0002_jazzy_shooting_star.sql';
import m0003 from './0003_remove_nag_state_columns.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003
    }
  }
  