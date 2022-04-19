import AppTile from './AppTile';
import charges from '../../mocks/charges.json';

export default {
    title: 'AppTile',
    component: AppTile,
};

export function Default() {
    const { landscape } = charges.initial;
    return <AppTile {...landscape} />;
}
