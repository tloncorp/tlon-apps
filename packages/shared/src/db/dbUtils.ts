import { createDevLogger } from '../debug';

const logger = createDevLogger('dbUtils', false);

export async function processBatchOperation<T, R>(
  items: T[],
  batchSize: number,
  operationFn: (batch: T[]) => Promise<R>,
  errorMessage: string
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    try {
      const batchResult = await operationFn(batch);
      results.push(batchResult);
    } catch (e) {
      logger.error(`${errorMessage}`, e);
    }
  }
  return results;
}
