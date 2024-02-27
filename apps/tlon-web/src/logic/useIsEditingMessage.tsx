import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function useIsEditingMessage() {
  const [searchParams] = useSearchParams();
  const isEditing = useMemo(() => !!searchParams.get('edit'), [searchParams]);

  return isEditing;
}
