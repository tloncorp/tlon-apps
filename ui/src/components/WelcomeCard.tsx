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
    <div className="mx-3 mt-1 mb-4 space-y-6 rounded-[32px] bg-[#edf3fb] p-9 text-[#165FCD]">
      <h3 className="text-[17px] font-medium">Welcome to our pilot program</h3>
      <p>
        Tlon is built on an open source, user-owned network. This presents
        unique development challenges. You may encounter turbulence while we
        make the experience as smooth as any other app. Help us improve by
        providing feedback.
      </p>
      <div className="space-x-3 text-right text-[17px] font-medium">
        <button
          className="rounded-lg bg-[#E4E9F1] px-4 py-2.5 active:opacity-90"
          onClick={() => setIsWelcomeSeen(true)}
        >
          Close
        </button>
        <Link
          to="/profile"
          className="rounded-lg bg-[#165FCD] px-4 py-2.5 text-[#FFF] active:opacity-90"
          onClick={() => setIsWelcomeSeen(true)}
        >
          Go to Profile
        </Link>
      </div>
    </div>
  );
}
