export default interface LeapOption {
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  to: string;
  resultIndex: number;
  // eslint-disable-next-line semi
}
