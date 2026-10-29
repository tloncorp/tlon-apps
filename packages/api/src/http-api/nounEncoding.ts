import { Atom, Noun } from '@urbit/nockjs';

class BitWriter {
  private bytes = new Uint8Array(256);
  length = 0;

  write(value: bigint, width: number) {
    const needed = Math.ceil((this.length + width) / 8);
    if (needed > this.bytes.length) {
      const next = new Uint8Array(Math.max(needed, this.bytes.length * 2));
      next.set(this.bytes);
      this.bytes = next;
    }

    while (width > 0) {
      const shift = this.length % 8;
      const count = Math.min(8 - shift, width);
      const bits = BigInt(count);
      this.bytes[Math.floor(this.length / 8)] |=
        Number(value & ((1n << bits) - 1n)) << shift;
      value >>= bits;
      width -= count;
      this.length += count;
    }
  }

  finish() {
    return this.bytes.slice(0, Math.ceil(this.length / 8));
  }
}

function bitLength(value: bigint) {
  return value === 0n ? 0 : value.toString(2).length;
}

function writeAtom(writer: BitWriter, value: bigint) {
  if (value === 0n) {
    writer.write(1n, 1);
    return;
  }

  const width = bitLength(value);
  const size = bitLength(BigInt(width));
  writer.write(0n, size);
  writer.write(1n, 1);
  writer.write(BigInt(width), size - 1);
  writer.write(value, width);
}

// Keep the aggregate in bytes: supported native engines limit a single BigInt.
export function jamBytes(noun: Noun): Uint8Array<ArrayBuffer> {
  const writer = new BitWriter();
  const seen = new Map<number, { noun: Noun; offset: number }[]>();
  const pending = [noun];

  while (pending.length > 0) {
    const value = pending.pop()!;
    const hash = value.mug();
    const bucket = seen.get(hash);
    const previous = bucket?.find((entry) => entry.noun.equals(value));

    if (
      previous &&
      (!(value instanceof Atom) ||
        bitLength(value.number) > bitLength(BigInt(previous.offset)))
    ) {
      writer.write(3n, 2);
      writeAtom(writer, BigInt(previous.offset));
      continue;
    }

    if (!previous) {
      const entry = { noun: value, offset: writer.length };
      if (bucket) {
        bucket.push(entry);
      } else {
        seen.set(hash, [entry]);
      }
    }

    if (value instanceof Atom) {
      writer.write(0n, 1);
      writeAtom(writer, value.number);
    } else {
      writer.write(1n, 2);
      pending.push(value.tail, value.head);
    }
  }

  return writer.finish();
}

export function jamToUw(noun: Noun): string {
  const bytes = jamBytes(noun);
  const alphabet =
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-~';
  const digits: string[] = [];

  for (let bit = 0; bit < bytes.length * 8; bit += 6) {
    const byte = Math.floor(bit / 8);
    const shift = bit % 8;
    const digit =
      ((bytes[byte] >> shift) | ((bytes[byte + 1] ?? 0) << (8 - shift))) & 63;
    digits.push(alphabet[digit]);
  }

  while (digits.length > 1 && digits[digits.length - 1] === '0') {
    digits.pop();
  }

  const text = digits.reverse().join('');
  const first = text.length % 5 || 5;
  const groups = [text.slice(0, first)];
  for (let offset = first; offset < text.length; offset += 5) {
    groups.push(text.slice(offset, offset + 5));
  }
  return `0w${groups.join('.')}`;
}
