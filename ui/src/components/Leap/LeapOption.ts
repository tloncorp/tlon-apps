import { ILeapOption } from './ILeapOption';

export default class LeapOption implements ILeapOption {
  onSelect: () => void;

  icon: React.ReactNode;

  title: string;

  subtitle: string;

  to: string;

  constructor({
    onSelect,
    icon,
    title,
    subtitle,
    to,
  }: {
    onSelect: () => void;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    to: string;
  }) {
    this.onSelect = onSelect;
    this.icon = icon;
    this.title = title;
    this.subtitle = subtitle;
    this.to = to;
  }
}
