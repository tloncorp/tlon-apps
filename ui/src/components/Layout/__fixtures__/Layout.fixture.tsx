import Layout from '../Layout';

export default function LayoutFixture() {
    const footer = <div className="bg-blue flex-1 p-4">footer</div>;
    const header = <div className="bg-red flex-1 p-4">header</div>;
    const aside = <div className="bg-green flex-1 p-4">aside</div>;
    const content = <div className="bg-orange flex-1 p-4">content</div>;
  return (
    <Layout footer={footer} header={header} aside={aside} stickyHeader={true}>
      {content}
    </Layout>
  );
}
