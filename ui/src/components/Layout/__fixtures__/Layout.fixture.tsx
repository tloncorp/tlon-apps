import Layout from '../Layout';

export default function LayoutFixture() {
  const footer = <div className="flex-1 bg-blue p-4">footer</div>;
  const header = <div className="flex-1 bg-red p-4">header</div>;
  const aside = <div className="flex-1 bg-green p-4">aside</div>;
  const content = <div className="flex-1 bg-orange p-4">content</div>;
  return (
    <Layout footer={footer} header={header} aside={aside} stickyHeader={true}>
      {content}
    </Layout>
  );
}
