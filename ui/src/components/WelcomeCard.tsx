import { usePutEntryMutation, useSeenWelcomeCard } from '@/state/settings';
import { useCallback, useEffect, useState } from 'react';
import { useIsMobile } from '@/logic/useMedia';
import { Link, useLocation } from 'react-router-dom';
import { getDmLink } from '@/logic/branch';
import X16Icon from './icons/X16Icon';

export default function WelcomeCard() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const alreadySeen = useSeenWelcomeCard();
  const { mutate } = usePutEntryMutation({
    bucket: 'groups',
    key: 'seenWelcomeCard',
  });
  const [optimisticallyHide, setOptimisticallyHide] = useState(false);
  const welcomeCardHidden = alreadySeen || optimisticallyHide;

  useEffect(() => {
    if (!welcomeCardHidden) {
      getDmLink();
    }
  }, [welcomeCardHidden]);

  const close = useCallback(() => {
    setOptimisticallyHide(true);
    mutate({ val: true });
  }, [mutate]);

  const TlonStudioLink = useCallback(
    () => (
      <Link
        className="font-semibold no-underline dark:font-bold"
        to="/gangs/~tommur-dostyn/tlon-studio"
        state={{ backgroundLocation: location }}
      >
        Tlon Studio
      </Link>
    ),
    [location]
  );

  if (welcomeCardHidden) {
    return null;
  }

  if (isMobile) {
    return (
      <div className="mx-6 mb-4 mt-2 space-y-4 rounded-[32px] bg-green-soft px-8 py-6">
        <h3 className="text-lg font-medium">Welcome to Tlon</h3>
        <p className="leading-5">
          This is Tlon: An app for messaging friends and constructing
          communities.
        </p>
        <p className="leading-5">
          Visit the <TlonStudioLink /> group to learn more about what we&#39;re
          working on now
        </p>
        <div className="space-x-3 text-right font-medium">
          <button
            className="mt-2 rounded-lg px-3 py-2 active:opacity-90 dark:bg-green-800"
            onClick={() => close()}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 mt-2 max-w-[800px] space-y-2 rounded-xl bg-green-soft p-6">
      <div className="flex w-full justify-between">
        <h3 className="text-lg font-medium">Welcome to Tlon</h3>
        <button
          className="relative bottom-3 left-3 rounded-full p-1 dark:bg-green-800"
          onClick={() => close()}
        >
          <X16Icon className="h-4 w-4" />
        </button>
      </div>
      <p className="leading-5">
        This is Tlon: An app for messaging friends and constructing communities.
        Visit the <TlonStudioLink /> group to learn more about what we&#39;re
        working on now.
      </p>
    </div>
  );
}
