import ConfirmationModal from '@/components/ConfirmationModal';

export default function ConfirmationModalFixture({
  title = 'Test',
  message = "Here's the message!",
}: {
  title: string;
  message: string;
}) {
  return (
    <div>
      <ConfirmationModal
        setOpen={() => null}
        onConfirm={() => null}
        title={title}
        open={true}
        message={message}
      />
    </div>
  );
}
