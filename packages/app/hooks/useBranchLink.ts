import { getDmLink } from '@tloncorp/shared/dist/logic';
import { useEffect, useState } from 'react';

import { BRANCH_DOMAIN, BRANCH_KEY } from '../constants';
import { useCurrentUserId } from '../hooks/useCurrentUser';

export function useDMLureLink() {
  const currentUserId = useCurrentUserId();
  const [dmLink, setDmLink] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function populateLink() {
      setIsLoading(true);
      setError(null);
      try {
        const link = await getDmLink(currentUserId, BRANCH_DOMAIN, BRANCH_KEY);
        setDmLink(link);
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error('An error occurred while fetching the deep link')
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (currentUserId) {
      populateLink();
    } else {
      setDmLink('');
      setIsLoading(false);
    }
  }, [currentUserId, setDmLink, setIsLoading, setError]);

  return { dmLink, isLoading, error };
}
