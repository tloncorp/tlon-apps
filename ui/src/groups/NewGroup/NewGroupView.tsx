import Layout from '@/components/Layout/Layout';
import MobileHeader from '@/components/MobileHeader';
import NewGroup from './NewGroup';

export default function NewGroupView() {
  return (
    <Layout
      header={
        <MobileHeader title="New Group" pathBack="/" pathBackText="Cancel" />
      }
      className=""
    >
      <div className="p-4">
        <NewGroup />
      </div>
    </Layout>
  );
}
