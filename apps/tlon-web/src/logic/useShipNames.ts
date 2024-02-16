import { useContacts } from '@/state/contact';
import { preSig } from '@urbit/aura';

type Props = {
  ships: string[];
};

export default function useShipNames({ ships }: Props) {
  const contacts = useContacts();
  return ships
    .map((ship) => contacts[preSig(ship)]?.nickname ?? ship)
    .join(', ');
}
