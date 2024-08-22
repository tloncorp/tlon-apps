import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { render, screen, userEvent } from '@testing-library/react-native';

import { HeaderButton } from '../components/HeaderButton';

describe('HeaderButton', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders', async () => {
    const user = userEvent.setup();

    const onPress = jest.fn();
    render(<HeaderButton title="Test" onPress={onPress} />);
    await user.press(await screen.findByText('Test'));
    expect(onPress).toHaveBeenCalled();
  });
});