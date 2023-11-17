import { useLocalStorage } from 'usehooks-ts';

import { createStorageKey } from '@/logic/utils';

export default function WelcomeCard() {
  const [isWelcomeSeen, setIsWelcomeSeen] = useLocalStorage<boolean>(
    createStorageKey('welcome-seen'),
    false
  );

  if (isWelcomeSeen) {
    return null;
  }

  return (
    <div className="mx-3 mt-1 mb-4 space-y-6 rounded-[32px] bg-[#edf3fb] p-9 text-[#165FCD]">
      <h3 className="text-[17px] font-medium">Welcome to Tlon</h3>
      <p>Tip 1 of 3</p>
      <p>
        Visit the Tlon Studio group to learn more about what we&apos;re working
        on now.
      </p>
      <div className="space-x-3 text-right text-[17px] font-medium">
        <button className="rounded-lg bg-[#E4E9F1] px-4 py-2.5 active:opacity-90">
          Close
        </button>
        <button className="rounded-lg bg-[#165FCD] px-4 py-2.5 text-[#FFF] active:opacity-90">
          Next Tip
        </button>
      </div>
    </div>
  );
}
