import ErrorAlert from '@/components/ErrorAlert';

export default function ErrorAlertFixture() {
  return (
    <ErrorAlert
      error={new Error('Something bad happened')}
      resetErrorBoundary={() => null}
    />
  );
}
