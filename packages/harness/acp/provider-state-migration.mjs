// Persisted-state compatibility is confined to this migration.
export function migrateProviderState(data) {
  if (data?.version !== 1) return data
  if (!Array.isArray(data.receipts)) throw new Error('Invalid version 1 provider receipts.')
  return { ...data, version: 2, receipts: data.receipts.map(receipt => ({ ...receipt, calls: [] })) }
}
