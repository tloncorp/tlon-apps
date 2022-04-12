import React from 'react'
import { describe, expect, it } from 'vitest'
import { AppTile } from './AppTile'
import { render, screen } from '../../test/utils'

describe('AppTile', () => {
  describe('when image is available', () => {
    it('it renders an image', () => {
      render(<AppTile color='#fefefe' image="test.jpg" />)
      expect(screen.getByAltText('urbit app tile')).toBeInTheDocument()
    })
  });

  describe('when image is not available', () => {
    it('it does not render an image', () => {
      render(<AppTile color='#fefefe' />)
      expect(screen.queryByAltText('urbit app tile')).toBeNull()
    })
  });
})
