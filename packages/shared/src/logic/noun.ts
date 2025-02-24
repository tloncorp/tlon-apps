import { daToUnix, formatUv, patp } from '@urbit/aura';
import { Atom, Cell, EnjsFunction, Noun, enjs } from '@urbit/nockjs';

type Json = ReturnType<EnjsFunction>;

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

  return patp(noun.number);
};

export const getUv: EnjsFunction = runIfAtom((a) => formatUv(a.number));

export const time: EnjsFunction = runIfAtom((a) => daToUnix(a.number));

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

export function getFrondValue(opts: frondOpt[]): EnjsFunction {
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
