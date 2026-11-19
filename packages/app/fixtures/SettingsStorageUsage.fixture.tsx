import { SettingsList } from '../ui/components/SettingsList';

function StorageUsage({
  value,
  progress,
}: {
  value: string;
  progress?: number;
}) {
  return (
    <SettingsList
      maxWidth={600}
      sections={[
        {
          key: 'usage',
          title: 'Usage',
          rows: [
            {
              key: 'storage',
              title: 'Tlon Storage',
              value,
              progress,
              testID: 'SettingsStorageRow',
            },
          ],
        },
      ]}
    />
  );
}

export default {
  Used: <StorageUsage value="7.5 GB of 40 GB" progress={0.1875} />,
  Empty: <StorageUsage value="0 GB of 40 GB" progress={0} />,
  Full: <StorageUsage value="40 GB of 40 GB" progress={1} />,
  Checking: <StorageUsage value="Checking…" />,
  Unavailable: <StorageUsage value="Unavailable" />,
};
