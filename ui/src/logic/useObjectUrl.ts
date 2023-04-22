import { useEffect, useState } from 'react';

/**
 * React Hook that receives an instance of `File`, `Blob` or `MediaSource` and
 * creates an URL representing it, providing a state object containing the file
 * with a set function to change the file object. It releases URL when component
 * unmount or parameter changes.
 * @param initialObject - `null` or an instance of `File`, `Blob` or `MediaSource`.
 */
export default function useObjectURL(
  initialObject: null | File | Blob | MediaSource
) {
  const [objectURL, setObjectURL] = useState<null | string>(null);

  const [object, setObject] = useState<null | File | Blob | MediaSource>(
    initialObject
  );

  useEffect(() => {
    if (!object) {
      return;
    }

    if (objectURL) {
      URL.revokeObjectURL(objectURL);
    }

    const url = URL.createObjectURL(object);
    setObjectURL(url);

    // eslint-disable-next-line consistent-return
    return () => {
      if (!objectURL) {
        return;
      }

      URL.revokeObjectURL(objectURL);
      setObjectURL(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object]);

  return {
    url: objectURL,
    object,
    setObject,
  };
}
