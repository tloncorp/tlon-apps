import { MemoryRouter } from 'react-router';
import { useCurrentTheme } from '@/state/local';
import EmojiPicker from '@/components/EmojiPicker';

export default function EmojiPickerFixture() {
  const currentTheme = useCurrentTheme();
  return (
    <MemoryRouter>
      <EmojiPicker open={true} setOpen={() => {}} />
    </MemoryRouter>
  );
}
