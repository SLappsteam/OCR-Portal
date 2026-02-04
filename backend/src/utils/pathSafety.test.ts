import assert from 'assert';
import path from 'path';
import { assertPathContained, parseSafeInteger } from './pathSafety';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`        ${(err as Error).message}`);
  }
}

console.log('\n--- assertPathContained ---\n');

const storageRoot = path.resolve(
  process.env['TIFF_STORAGE_PATH'] ?? './storage/tiffs'
);

test('allows path inside storage root', () => {
  const input = path.join(storageRoot, 'ST01', 'file.tif');
  const result = assertPathContained(input);
  assert.strictEqual(result, path.normalize(input));
});

test('blocks traversal with ../', () => {
  const input = path.join(storageRoot, '..', '..', 'etc', 'passwd');
  assert.throws(() => assertPathContained(input), /outside allowed/);
});

test('blocks traversal with encoded ..', () => {
  const input = storageRoot + path.sep + '..\\..\\Windows\\System32\\config\\sam';
  assert.throws(() => assertPathContained(input), /outside allowed/);
});

test('blocks UNC paths', () => {
  assert.throws(() => assertPathContained('\\\\evil-server\\share\\file'), /UNC/);
});

test('blocks null bytes', () => {
  assert.throws(
    () => assertPathContained(storageRoot + '/file.tif\0.jpg'),
    /Invalid/
  );
});

test('blocks absolute path outside roots', () => {
  assert.throws(
    () => assertPathContained('C:\\Windows\\System32\\cmd.exe'),
    /outside allowed/
  );
});

test('blocks empty string', () => {
  assert.throws(() => assertPathContained(''), /required/);
});

test('blocks http URL', () => {
  assert.throws(
    () => assertPathContained('http://evil.com/file'),
    /UNC and remote/
  );
});

test('blocks file:// URL', () => {
  assert.throws(
    () => assertPathContained('file:///etc/passwd'),
    /UNC and remote/
  );
});

console.log('\n--- parseSafeInteger ---\n');

test('parses valid port number', () => {
  assert.strictEqual(parseSafeInteger(3000, 1, 65535), 3000);
});

test('parses string port number', () => {
  assert.strictEqual(parseSafeInteger('8080', 1, 65535), 8080);
});

test('rejects zero', () => {
  assert.strictEqual(parseSafeInteger(0, 1, 65535), null);
});

test('rejects negative', () => {
  assert.strictEqual(parseSafeInteger(-1, 1, 65535), null);
});

test('rejects above max', () => {
  assert.strictEqual(parseSafeInteger(99999, 1, 65535), null);
});

test('rejects float', () => {
  assert.strictEqual(parseSafeInteger(3.14, 1, 65535), null);
});

test('rejects NaN string', () => {
  assert.strictEqual(parseSafeInteger('abc', 1, 65535), null);
});

test('parseInt strips shell metacharacters, returns safe integer', () => {
  // parseInt('3000; rm -rf /') → 3000 which is safe.
  // Combined with execFileSync (no shell), this is not exploitable.
  assert.strictEqual(parseSafeInteger('3000; rm -rf /', 1, 65535), 3000);
});

test('rejects non-numeric string', () => {
  assert.strictEqual(parseSafeInteger('; rm -rf /', 1, 65535), null);
});

test('valid PID', () => {
  assert.strictEqual(parseSafeInteger(1234, 1, 4194304), 1234);
});

test('rejects PID above max', () => {
  assert.strictEqual(parseSafeInteger(5000000, 1, 4194304), null);
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
