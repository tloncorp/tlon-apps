import {useCallback, useEffect, useMemo, useState} from 'react';

export const useListPicker = <T extends {id: string}>(value?: T[] | null) => {
  const [selectedItems, setSelectedItems] = useState<Record<string, T>>(() =>
    getAsMap(value),
  );
  // Reset items when value changes
  useEffect(() => {
    setSelectedItems(getAsMap(value));
  }, [value]);
  const count = useMemo(
    () => Object.keys(selectedItems).length,
    [selectedItems],
  );
  const handleItemToggled = useCallback((item: T) => {
    setSelectedItems(items => {
      const newItems = {...items};
      if (newItems[item.id]) {
        delete newItems[item.id];
      } else {
        newItems[item.id] = item;
      }
      return newItems;
    });
  }, []);
  const handleItemsCleared = useCallback(() => {
    setSelectedItems({});
  }, []);
  return useMemo(
    () => ({
      selectedItemCount: count,
      selectedItems,
      handleItemToggled,
      handleItemsCleared,
    }),
    [count, selectedItems, handleItemToggled, handleItemsCleared],
  );
};

function getAsMap<T extends {id: string}>(value?: T[] | null) {
  return (
    value?.reduce((memo, item) => {
      memo[item.id] = item;
      return memo;
    }, {}) ?? {}
  );
}
