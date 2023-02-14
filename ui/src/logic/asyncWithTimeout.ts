/**
 * Call an async function with a maximum time limit (in milliseconds) for the timeout
 * @param {Promise<any>} asyncPromise An asynchronous promise to resolve
 * @param {number} timeLimit Time limit to attempt function in milliseconds
 * @returns {Promise<any> | undefined} Resolved promise for async function call, or an error if time limit reached
 */
export default async function asyncCallWithTimeout<T>(
  asyncPromise: Promise<T>,
  timeLimit: number
) {
  let timeoutHandle: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('Async call timeout limit reached')),
      timeLimit
    );
  });

  return (Promise.race([asyncPromise, timeoutPromise]) as Promise<T>).then(
    (result) => {
      clearTimeout(timeoutHandle);
      return result;
    }
  );
}
