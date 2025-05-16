import { useQuery } from '@tanstack/react-query';

import { getLinkMetadata } from '../api';
import { isValidUrl } from '../logic';

export function useLinkGrabber(url: string) {
  return useQuery({
    queryKey: ['metagrab', url],
    queryFn: () => getLinkMetadata(url),
    enabled: !!url && isValidUrl(url),
  });
}
