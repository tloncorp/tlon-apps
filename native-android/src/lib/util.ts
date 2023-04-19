export const URBIT_HOME_REGEX = /\<title\>Landscape.*?Home\<\/title\>/i;
export const SHIP_COOKIE_REGEX = /(~)[a-z\-]+?(\=)/;

export async function asyncForEach<T>(
  array: Array<T>,
  callback: (element: T, idx?: number, ary?: Array<T>) => Promise<void>
) {
  await Promise.all(array.map((e, i) => callback(e, i, array)));
}
