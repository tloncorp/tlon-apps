import MobileHeader from '@/components/MobileHeader';
import NewGroup from './NewGroup';

export default function NewGroupView() {
  return (
    <div className="flex h-full w-full flex-col">
      <MobileHeader title="New Group" pathBack="/" pathBackText="Cancel" />
      <div className="grow overflow-y-auto p-4">
        <NewGroup />
      </div>
    </div>
  );
}
