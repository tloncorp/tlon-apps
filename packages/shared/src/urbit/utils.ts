type App = 'chat' | 'heap' | 'diary';

export function checkNest(nest: string) {
  if (nest.split('/').length !== 3) {
    console.error('Invalid nest:', nest);
  }
}

export function nestToFlag(nest: string): [App, string] {
  checkNest(nest);
  const [app, ...rest] = nest.split('/');

  return [app as App, rest.join('/')];
}

