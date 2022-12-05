import BulletIcon from '../icons/BulletIcon';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';
import NewMessageIcon from '../icons/NewMessageIcon';
import PersonIcon from '../icons/PersonIcon';

export interface IMenuOption {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  to: string;
}

// TODO: filter the options based on the app; e.g., doesn't make sense to
// show Find Groups in Talk... or should it open Groups?
// Also, what if user doesn't have Talk or Groups installed?
const menuOptions: IMenuOption[] = [
  {
    title: 'Notifications',
    subtitle: '',
    to: '/',
    icon: BulletIcon,
  },
  {
    title: 'Messages',
    subtitle: '',
    to: '/', // TODO: In Groups, this should open Talk; in Talk, this should go to root? Or should it not be shown at all?
    icon: NewMessageIcon,
  },
  {
    title: 'Find Groups',
    subtitle: '',
    to: '/find',
    icon: MagnifyingGlassIcon,
  },
  {
    title: 'Profile',
    subtitle: '',
    to: '/profile/edit',
    icon: PersonIcon, // TODO: Sigil
  },
];

export default menuOptions;
