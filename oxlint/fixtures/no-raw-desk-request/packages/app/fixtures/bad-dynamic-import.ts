// expect: tlon/no-raw-desk-request
export async function load() {
  const { scry } = await import('@tloncorp/api');
  return scry({ app: 'groups', path: '/v3/groups' });
}
