import React, {
  ComponentType,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import {FlatList, ListRenderItemInfo} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  ScrollViewProps,
  TamaguiComponent,
  styled,
  withStaticProperties,
} from 'tamagui';
import {pluralize} from '../../utils/format';
import {Input, SizableText, XStack, YStack} from './core';
import {Button} from './core/Button';
import {ListItemProps} from './ListItem';
import {Sheet, SheetHeader} from './Sheet';
import {useListPicker} from '../../utils/useListPicker';
import {RadioToggle} from './RadioToggle';
import * as db from '@db';

export function ListPicker<T extends {id: string}>({
  value,
  onChange,
  getOptions,
  ItemComponent,
  PreviewComponent,
}: {
  value?: T[];
  onChange?: (newValue: T[]) => void;
  getOptions: (
    searchQuery: string | null,
    ops: db.Operations,
  ) => T[] | ReadonlyArray<T>;
  ItemComponent: ComponentType<ListItemProps<T>>;
  PreviewComponent: ComponentType<{model: T}>;
}) {
  // Store the working value here until we're ready to commit it.
  const [workingValue, setWorkingValue] = useState<T[]>(value ?? []);

  const [isOpen, setIsOpen] = useState(false);

  const handlePressOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handlePressCancel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSubmit = useCallback(() => {
    setIsOpen(false);
    onChange?.(workingValue);
  }, [onChange, workingValue]);

  const handleValueChange = useCallback((newValue: T[]) => {
    setWorkingValue(newValue);
  }, []);

  return (
    <>
      <ListPickerPreview
        ItemComponent={PreviewComponent}
        selectedItems={workingValue}
        onPressOpen={handlePressOpen}
      />
      <ListPickerSheet
        isOpen={isOpen}
        onPressCancel={handlePressCancel}
        onPressSubmit={handleSubmit}
        onDismiss={handleSubmit}>
        <ListPickerList
          value={value}
          onChange={handleValueChange}
          PickerItem={ItemComponent}
          getOptions={getOptions}
        />
      </ListPickerSheet>
    </>
  );
}

function ListPickerSheet({
  children,
  isOpen,
  onPressCancel,
  onPressSubmit,
  onDismiss,
}: PropsWithChildren<{
  onPressCancel?: () => void;
  onPressSubmit?: () => void;
  isOpen?: boolean;
  onDismiss?: () => void;
}>) {
  const [, startTransition] = useTransition();

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onDismiss?.();
      }
    },
    [onDismiss],
  );

  const handlePressCancel = useCallback(() => {
    onPressCancel && startTransition(onPressCancel);
  }, [onPressCancel]);

  const handlePressSubmit = useCallback(() => {
    onPressSubmit && startTransition(onPressSubmit);
  }, [onPressSubmit]);

  return (
    <Sheet
      open={isOpen}
      modal={true}
      onOpenChange={handleOpenChange}
      dismissOnSnapToBottom={true}
      defaultOpen={false}>
      <Sheet.Overlay />
      <Sheet.Frame>
        <SheetHeader>
          <SheetHeader.LeftControls>
            <SheetHeader.Button onPress={handlePressCancel}>
              <SheetHeader.ButtonText>Cancel</SheetHeader.ButtonText>
            </SheetHeader.Button>
          </SheetHeader.LeftControls>
          <SheetHeader.Title>
            <SheetHeader.TitleText>Select Channels</SheetHeader.TitleText>
          </SheetHeader.Title>
          <SheetHeader.RightControls>
            <SheetHeader.Button>
              <SheetHeader.ButtonText onPress={handlePressSubmit}>
                Done
              </SheetHeader.ButtonText>
            </SheetHeader.Button>
          </SheetHeader.RightControls>
        </SheetHeader>
        {children}
      </Sheet.Frame>
    </Sheet>
  );
}

ListPickerSheet.displayName = 'ListPickerSheet';

export function ListPickerList<T extends {id: string}>({
  PickerItem,
  value,
  getOptions,
  onChange,
}: {
  PickerItem: ComponentType<ListItemProps<T>>;
  value?: T[];
  getOptions: (
    searchQuery: string | null,
    ops: db.Operations,
  ) => T[] | ReadonlyArray<T>;
  onChange?: (newValue: T[]) => void;
}) {
  const [searchQuery, setSearchQuery] = useState<string | null>(null);

  const ops = db.useOps();
  const options = useMemo(
    () => getOptions(searchQuery, ops),
    [getOptions, searchQuery, ops],
  );

  const {
    selectedItems,
    selectedItemCount,
    handleItemToggled,
    handleItemsCleared,
  } = useListPicker<T>(value);

  useEffect(() => {
    onChange?.(Object.values(selectedItems));
  }, [onChange, selectedItems]);

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<T>) => {
      const isSelected = !!selectedItems?.[item.id];
      return (
        <PickerItem
          onPress={handleItemToggled}
          highlighted={isSelected}
          model={item}
        />
      );
    },
    [PickerItem, handleItemToggled, selectedItems],
  );

  const getItemKey = useCallback((item: T) => {
    return item.id;
  }, []);

  const renderScrollComponent = useCallback((props: ScrollViewProps) => {
    return <Sheet.ScrollView {...props} />;
  }, []);

  return (
    <XStack flex={1}>
      <YStack flex={1}>
        <XStack
          padding="$s"
          borderBottomWidth={1}
          borderBottomColor="$borderColor">
          <Input placeholder="Filter" flex={1} onChangeText={setSearchQuery} />
        </XStack>
        <FlatList
          data={options}
          renderItem={renderItem}
          keyExtractor={getItemKey}
          renderScrollComponent={renderScrollComponent}
        />
      </YStack>
      <ListPickerStatus
        onPressClear={handleItemsCleared}
        selectedItemCount={selectedItemCount}
      />
    </XStack>
  );
}

/**
 * Displayed value of the picker
 */
export function ListPickerPreview<T extends {id: string}>({
  onPressOpen,
  selectedItems,
  ItemComponent,
}: {
  onPressOpen: () => void;
  selectedItems: T[];
  ItemComponent: ComponentType<{model: T}>;
}) {
  return (
    <YStack gap="$s" alignItems="flex-start">
      <XStack gap="$xs" flexWrap="wrap">
        {selectedItems?.map(model => (
          <ItemComponent key={model.id} model={model} />
        )) ?? null}
      </XStack>
      <Button onPress={onPressOpen}>
        <Button.Text>Edit</Button.Text>
      </Button>
    </YStack>
  );
}

/**
 * Wraps a ListItem with a radio toggle for selected status.
 */
export const createPickerItem = <
  M extends {id: string},
  P extends ListItemProps<M>,
>(
  Component: ComponentType<P>,
) => {
  const ListPickerItem = (props: P) => {
    return (
      <Component
        {...props}
        StartIcon={
          <>
            <RadioToggle isChecked={!!props.highlighted} />
            {props.StartIcon}
          </>
        }
      />
    );
  };
  ListPickerItem.displayName = `ListPickerItem(${Component.displayName})`;
  return React.memo(ListPickerItem);
};

// Bottom status frame

const ListPickerStatusFrame = styled(XStack, {
  name: 'ListPickerStatusFrame',
  position: 'absolute',
  right: 0,
  left: 0,
  justifyContent: 'center',
  alignItems: 'center',
  borderTopWidth: 1,
  backgroundColor: '$background',
  borderTopColor: '$border',
});

const ListPickerStatusContent = styled(XStack, {
  backgroundColor: '$background',
  alignItems: 'center',
  justifyContent: 'space-between',
  flex: 1,
  paddingBottom: '$l',
  paddingTop: '$m',
  paddingHorizontal: '$m',
});

const ListPickerStatusText = styled(SizableText, {});

interface ListPickerStatusProps {
  selectedItemCount: number;
  onPressClear: () => void;
}

const ListPickerStatusComponent = ({
  selectedItemCount,
  onPressClear,
}: ListPickerStatusProps) => {
  const insets = useSafeAreaInsets();
  return (
    <ListPickerStatusFrame bottom={0} paddingBottom={insets.bottom}>
      <ListPickerStatusContent>
        <SizableText color="$tertiaryText">
          {`${selectedItemCount} ${pluralize(
            selectedItemCount,
            'item',
          )} selected`}
        </SizableText>
        <Button onPress={onPressClear}>
          <Button.Text>Clear</Button.Text>
        </Button>
      </ListPickerStatusContent>
    </ListPickerStatusFrame>
  );
};

ListPickerStatusComponent.displayName = 'ListPickerStatus';

const ListPickerStatus = withStaticProperties(ListPickerStatusComponent, {
  Content: ListPickerStatusContent,
  Text: ListPickerStatusText,
});
