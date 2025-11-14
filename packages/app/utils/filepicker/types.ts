export type PickFile = () => Promise<
  ({ type: 'uri'; uri: string } | { type: 'file'; file: File })[]
>;
