export default interface LeapOption {
  onSelect: () => void;
  icon: React.ReactNode;
  input?: string | undefined;
  title: string;
  subtitle: string;
  to: string;
  resultIndex: number;
  // eslint-disable-next-line semi
}
