export interface ILeapOption {
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  to: string;
}
