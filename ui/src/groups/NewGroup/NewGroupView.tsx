import Layout from '@/components/Layout/Layout';
import MobileHeader from '@/components/MobileHeader';
import NewGroup from './NewGroup';

export default function NewGroupView() {
  return (
    <Layout
      header={
        <MobileHeader title="New Group" pathBack="/" pathBackText="Cancel" />
      }
      className="flex-1 px-4"
    >
      <div className="pt-4">
        <NewGroup />
      </div>
    </Layout>
  );
}
