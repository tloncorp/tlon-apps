// expect: none
// The bridge in packages/ui is where both boundaries are enforced; this
// importer sees an ordinary module.
import { getAutomations, read } from '../../ui/src/bad-bridge';

getAutomations();
read({ app: 'groups', path: '/v99/new' });
