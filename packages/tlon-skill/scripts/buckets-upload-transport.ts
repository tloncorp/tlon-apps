import { readFile } from 'node:fs/promises';

/**
 * PUT a local file's bytes to the signed URL the Bucket's host handed back.
 *
 * The file is read into memory here rather than handed to fetch as
 * `Bun.file(path)`. The lazy Blob looked like the streaming option, but over
 * https Bun never streams it: fetch uses sendfile(2) only for plaintext URLs,
 * and otherwise reads the whole file synchronously before the request starts
 * (fetch.zig, prepare_body), so the heap cost is the same either way. What
 * differs is that in a standalone executable (`bun build --compile`) the copy
 * Bun makes of a file under 256 KiB is freed through the wrong allocator when
 * the request completes, and the process dies with a segmentation fault after
 * the bytes have reached storage -- Bun 1.3.14 on Linux, Bun 1.3.4 on macOS
 * (there as a bus error). `bun run` of the same source does not crash, which
 * is why it never showed up outside the shipped binary. An in-memory Blob is
 * the ordinary body path, and the one fetch frees correctly.
 *
 * tests/hermetic/buckets-upload-transport.test.ts runs this from a compiled
 * binary against a local TLS server, which is the only way to exercise it.
 */
export async function putUploadFile(
  url: string,
  headers: [string, string][],
  filePath: string
): Promise<Response> {
  const bytes = await readFile(filePath);
  return fetch(url, {
    method: 'PUT',
    // A redirect is a second destination nobody checked.
    redirect: 'error',
    // These headers are part of the GCS signature. Do not add a second
    // Content-Type with different casing: Fetch coalesces duplicate header
    // names and invalidates the signed canonical request. The Blob carries no
    // type of its own, so fetch adds nothing to them.
    headers: Object.fromEntries(headers),
    body: new Blob([bytes]),
  });
}
