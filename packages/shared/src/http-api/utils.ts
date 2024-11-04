export function camelize(str: string) {
  return str
    .replace(/\s(.)/g, function ($1: string) {
      return $1.toUpperCase();
    })
    .replace(/\s/g, '')
    .replace(/^(.)/, function ($1: string) {
      return $1.toLowerCase();
    });
}

export function uncamelize(str: string, separator = '-') {
  // Replace all capital letters by separator followed by lowercase one
  str = str.replace(/[A-Z]/g, function (letter: string) {
    return separator + letter.toLowerCase();
  });
  return str.replace(new RegExp('^' + separator), '');
}

/**
 * Returns a hex string of given length.
 *
 * Poached from StackOverflow.
 *
 * @param len Length of hex string to return.
 */
export function hexString(len: number): string {
  const maxlen = 8;
  const min = Math.pow(16, Math.min(len, maxlen) - 1);
  const max = Math.pow(16, Math.min(len, maxlen)) - 1;
  const n = Math.floor(Math.random() * (max - min + 1)) + min;
  let r = n.toString(16);
  while (r.length < len) {
    r = r + hexString(len - maxlen);
  }
  return r;
}

/**
 * Generates a random UID.
 *
 * Copied from https://github.com/urbit/urbit/blob/137e4428f617c13f28ed31e520eff98d251ed3e9/pkg/interface/src/lib/util.js#L3
 */
export function uid(): string {
  let str = '0v';
  str += Math.ceil(Math.random() * 8) + '.';
  for (let i = 0; i < 5; i++) {
    let _str = Math.ceil(Math.random() * 10000000).toString(32);
    _str = ('00000' + _str).substr(-5, 5);
    str += _str + '.';
  }
  return str.slice(0, -1);
}

export default class EventEmitter {
  private listeners: Record<string, ((...data: any[]) => void)[]> = {};

  on(event: string, callback: (...data: any[]) => void) {
    if (!(event in this.listeners)) {
      this.listeners[event] = [];
    }

    this.listeners[event].push(callback);

    return this;
  }

  emit(event: string, ...data: any): any {
    if (!(event in this.listeners)) {
      return null;
    }

    for (let i = 0; i < this.listeners[event].length; i++) {
      const callback = this.listeners[event][i];

      callback.call(this, ...data);
    }
  }
}
