/* eslint-disable import/no-extraneous-dependencies */
import React from 'react';
import { describe, expect, it } from 'vitest';
import renderer from 'react-test-renderer';
import AppTile from './AppTile';
import { render, screen } from '../../test/utils';

describe('AppTile', () => {
    describe('when image is available', () => {
        it('it renders an image', () => {
            render(<AppTile color="#fefefe" image="test.jpg" title="pals" />);
            expect(
                screen.getByAltText('app tile for pals')
            ).toBeInTheDocument();
        });
    });

    describe('when image is not available', () => {
        it('it does not render an image', () => {
            render(<AppTile color="#fefefe" title="pals" />);
            expect(screen.queryByAltText('app tile for pals')).toBeNull();
        });
    });

    it('renders as expected', () => {
        const tree = renderer
            .create(<AppTile color="#fefefe" image="test.jpg" title="pals" />)
            .toJSON();
        expect(tree).toMatchSnapshot();
    });
});
