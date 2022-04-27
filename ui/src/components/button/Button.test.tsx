import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import Button from './Button';

describe('Button', () => {
  it('renders as expected', () => {
    const { asFragment } = render(<Button>Hello!</Button>);
    expect(asFragment()).toMatchSnapshot();
  });
});
