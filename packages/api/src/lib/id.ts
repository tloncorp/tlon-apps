import { render, tryParse } from '@urbit/aura';

export function parseIdNumber(id: string): bigint {
  return tryParse('ud', id) || BigInt(id);
}

export function getCanonicalPostId(inputId: string) {
  let id = inputId;
  if (id[0] === '~') {
    id = id.split('/').pop()!;
  }
  if (id[3] !== '.') {
    id = render('ud', BigInt(id));
  }
  return id;
}
