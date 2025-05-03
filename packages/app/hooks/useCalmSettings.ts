import * as store from '@tloncorp/shared/store';
import * as db from '@tloncorp/shared/db';
import { setSetting } from '@tloncorp/shared/api';
import { useQueryClient } from '@tanstack/react-query';

export const useCalmSettings = () => {
  const calmSettingsQuery = store.useCalmSettings();
  const queryClient = useQueryClient();

  const updateCalmSetting = async (key: string, value: boolean) => {
    try {
      // First update local database
      await db.insertSettings({ [key]: value });
      
      // Then update the server
      await setSetting(key, value);
      
      // Invalidate the query to force a refresh
      queryClient.invalidateQueries({ queryKey: ['calmSettings'] });
      
      return true;
    } catch (error) {
      console.error(`Failed to update calm setting ${key}:`, error);
      return false;
    }
  };

  return { 
    calmSettings: calmSettingsQuery.data ?? null,
    isLoading: calmSettingsQuery.isLoading,
    updateCalmSetting,
  } as const;
};
