import { render, da } from '@urbit/aura';
import { Atom, Cell, Noun, enjs } from '@urbit/nockjs';

// TODO: nockjs should export these
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | {
      [key: string]: Json;
    };
export type EnjsFunction = (n: Noun) => Json;

export const giveNull: EnjsFunction = () => null;
export const maybe =
  (fn: EnjsFunction): EnjsFunction =>
  (noun: Noun) => {
    if (noun instanceof Atom) {
      return null;
    }

    return fn(noun.tail);
  };

export const getPatp: EnjsFunction = (noun: Noun) => {
  if (noun instanceof Cell) {
    throw new Error(`malformed patp ${noun.toString()}`);
  }

  return render('p', noun.number);
};

export const getUv: EnjsFunction = runIfAtom((a) => render('uv', a.number));

export const time: EnjsFunction = runIfAtom((a) => da.toUnix(a.number));

export function getMapAsObject<T>(
  noun: Noun,
  key: EnjsFunction,
  value: EnjsFunction
): Record<string, T> {
  return Object.fromEntries(
    enjs.tree((n: Noun) => {
      if (!(n instanceof Cell)) {
        throw new Error('malformed map');
      }

      return [key(n.head), value(n.tail)];
    })(noun) as [string, T][]
  );
}

export function runIfAtom(fn: (atom: Atom) => Json): EnjsFunction {
  return (noun: Noun) => {
    if (noun instanceof Cell) {
      throw new Error('malformed atom');
    }

    return fn(noun);
  };
}

export const logNoun =
  (fn: EnjsFunction, str: string): EnjsFunction =>
  (noun: Noun) => {
    console.log(str, noun.toString());
    return fn(noun);
  };

interface frondOpt {
  tag: string;
  get: EnjsFunction;
}

interface frondValueOpt<T> {
  tag: string;
  get: (noun: Noun) => T;
}

export function getFrondValue<T>(opts: frondValueOpt<T>[]): (n: Noun) => T {
  return (noun: Noun) => {
    if (!(noun instanceof Cell)) {
      throw new Error('malformed frond');
    }

    const tag = enjs.cord(noun.head);

    const opt = opts.find((o) => o.tag === tag);

    if (!opt) {
      throw new Error('unknown frond tag');
    }

    return opt.get(noun.tail);
  };
}
