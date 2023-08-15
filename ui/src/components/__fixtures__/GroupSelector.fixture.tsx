import GroupSelector from '@/components/GroupSelector';

export default function GroupSelectorFixture() {
  return (
    <GroupSelector
      placeholder="Select Groups"
      groups={[]}
      setGroups={() => null}
    />
  );
}
