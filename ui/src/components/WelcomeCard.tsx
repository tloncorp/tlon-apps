import { Link } from 'react-router-dom';
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
    <div className="mx-4 mt-1 mb-4 space-y-4 rounded-2xl bg-blue-soft p-4 text-blue-700 dark:text-black">
      <h3 className="text-lg font-medium">Welcome to our pilot program</h3>
      <p className="leading-5">
        Tlon is built on an open source, user-owned network. This presents
        unique development challenges. You may encounter turbulence while we
        make the experience as smooth as any other app. Help us improve by
        providing feedback.
      </p>
      <div className="space-x-3 text-right font-medium">
        <button
          className="rounded-lg bg-transparent px-4 py-2.5 active:opacity-90"
          onClick={() => setIsWelcomeSeen(true)}
        >
          Close
        </button>
        <Link
          to="/profile"
          className="rounded-lg bg-blue-700 px-4 py-2.5 text-blue-soft active:opacity-90  dark:bg-black"
          onClick={() => setIsWelcomeSeen(true)}
        >
          Go to Profile
        </Link>
      </div>
    </div>
  );
}
