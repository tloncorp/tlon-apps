// Entry point that tests/hermetic/buckets-upload-transport.test.ts compiles
// into a standalone binary, so the Bucket upload transport runs the way the
// shipped tlon binary runs it: `bun run` of the same source takes different
// paths inside fetch and has never reproduced the crash this guards against.
//
// Arguments: <url> <file> <headers-json>. Prints one JSON line to stdout and
// exits 0 on a 2xx, 1 on any other outcome. Anything else is a crash.
import { putUploadFile } from '../../scripts/buckets-upload-transport';

const [url, filePath, headersJson] = process.argv.slice(2);
if (!url || !filePath || !headersJson) {
  console.error('usage: buckets-upload-probe <url> <file> <headers-json>');
  process.exit(1);
}

try {
  const response = await putUploadFile(url, JSON.parse(headersJson), filePath);
  console.log(JSON.stringify({ status: response.status }));
  process.exit(response.ok ? 0 : 1);
} catch (error) {
  console.log(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    })
  );
  process.exit(1);
}
