import { preSig } from '@urbit/aura';

import { useContacts } from '@/state/contact';

type Props = {
  ships: string[];
};

export default function useShipNames({ ships }: Props) {
  const contacts = useContacts();
  return ships
    .map((ship) => contacts[preSig(ship)]?.nickname ?? ship)
    .join(', ');
}
