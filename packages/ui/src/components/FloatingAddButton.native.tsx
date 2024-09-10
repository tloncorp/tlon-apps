import ContextMenu from 'react-native-context-menu-view';

import { FloatingActionButton } from './FloatingActionButton';
import { Icon } from './Icon';

export function FloatingAddButton({
  setAddGroupOpen,
  setStartDmOpen,
}: {
  setAddGroupOpen: (open: boolean) => void;
  setStartDmOpen: (open: boolean) => void;
}) {
  return (
    <ContextMenu
      dropdownMenuMode={true}
      actions={[
        { title: 'Create or join a group' },
        { title: 'Start a direct message' },
      ]}
      onPress={(event) => {
        const { index } = event.nativeEvent;
        if (index === 0) {
          setAddGroupOpen(true);
        }
        if (index === 1) {
          setStartDmOpen(true);
        }
      }}
    >
      <FloatingActionButton
        icon={<Icon type="Add" size="$s" marginRight="$s" />}
        label={'Add'}
        onPress={() => {}}
      />
    </ContextMenu>
  );
}
