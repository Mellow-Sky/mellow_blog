import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';
import { remarkSafeMdx } from '../src/lib/mdx-safety';
const options = { ...runtime, remarkPlugins: [remarkSafeMdx] };
test('MDX renders allowed static components and fenced source code', async () => {
  const result = await evaluate('# 你好\n\n<Callout title="温柔提示">保存灵感</Callout>\n\n```cpp\n#include <iostream>\nint main() { return 0; }\n```', options);
  assert.equal(typeof result.default, 'function');
});
test('MDX rejects code execution, imports, event handlers, spreads and unsafe URLs', async () => {
  const sources = ['{process.env}', 'export const secret = process.env', '<Callout title={process.env.SECRET} />', '<img src="https://example.com/a" onError="alert(1)" />', '<Callout {...props} />', '<script>alert(1)</script>', '<a href="javascript:alert(1)">unsafe</a>', '<iframe src="https://example.com" />', '<process.exit />'];
  for (const source of sources) await assert.rejects(evaluate(source, options), Error, source);
});
