import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMarkdownCommand, continueMarkdownList, indentMarkdown, isSafeEditorUrl, markdownForMedia } from '../src/lib/markdown-editor';

test('加粗、斜体和删除线保留中文选择，重复操作可还原', () => {
  for (const [command, marker] of [['bold', '**'], ['italic', '*'], ['strike', '~~']] as const) {
    const result = applyMarkdownCommand('前文字后', 1, 3, command);
    assert.equal(result.text, `前${marker}文字${marker}后`);
    assert.equal(result.text.slice(result.start, result.end), '文字');
    const restored = applyMarkdownCommand(result.text, result.start, result.end, command);
    assert.deepEqual(restored, { text: '前文字后', start: 1, end: 3 });
  }
  assert.equal(applyMarkdownCommand('**文字**', 2, 4, 'italic').text, '***文字***');
  const empty = applyMarkdownCommand('', 0, 0, 'bold');
  assert.equal(empty.text.slice(empty.start, empty.end), '加粗文字');
});

test('标题、引用与列表按选中行操作，不改动相邻段落', () => {
  const text = '前段\n第一行\n第二行\n末段';
  const quote = applyMarkdownCommand(text, 3, 10, 'quote');
  assert.equal(quote.text, '前段\n> 第一行\n> 第二行\n末段');
  assert.equal(applyMarkdownCommand(quote.text, quote.start, quote.end, 'quote').text, text);
  assert.equal(applyMarkdownCommand('标题', 1, 1, 'heading').text, '## 标题');
  assert.equal(applyMarkdownCommand('## 标题', 4, 4, 'heading').text, '标题');
  assert.equal(applyMarkdownCommand('一\n二', 0, 3, 'ordered-list').text, '1. 一\n2. 二');
  assert.equal(applyMarkdownCommand('- 一\n- 二', 0, 7, 'task-list').text, '- [ ] 一\n- [ ] 二');
  assert.equal(applyMarkdownCommand('', 0, 0, 'unordered-list').text, '- 列表项目');
  assert.equal(applyMarkdownCommand('\n后段', 0, 0, 'heading').text, '## 标题文字\n后段');
  assert.equal(applyMarkdownCommand('\n\n后段', 0, 2, 'quote').text, '> \n> \n后段');
});

test('代码块自适应围栏，表格、分割线和摘要线独立成块', () => {
  const source = 'const sample = ```;';
  const code = applyMarkdownCommand(source, 0, source.length, 'code', { language: 'js\n```bad' });
  assert.equal(code.text, '````jsbad\nconst sample = ```;\n````\n\n');
  assert.equal(code.text.slice(code.start, code.end), source);
  const rule = applyMarkdownCommand('前文后文', 2, 2, 'rule');
  assert.equal(rule.text, '前文\n\n---\n\n后文');
  assert.equal(applyMarkdownCommand('', 0, 0, 'more').text, '<!--more-->\n\n');
  assert.ok(applyMarkdownCommand('一|二', 0, 3, 'table').text.includes('| 一\\|二 | 内容 |'));
});

test('链接与图片转义文件名和目标，禁止脚本与跨来源伪装', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,a', '//evil.example/a', '/\\evil.example/a', 'https://user:pass@example.com/a', 'https://example.com/\na']) {
    assert.equal(isSafeEditorUrl(url), false, url);
    assert.equal(markdownForMedia({ url, name: '图片', mime: 'image/png' }), '');
    assert.equal(applyMarkdownCommand('文字', 0, 2, 'link', { url }).text, '文字');
  }
  assert.equal(isSafeEditorUrl('mailto:demo@example.com'), true);
  assert.equal(isSafeEditorUrl('mailto:demo@example.com', true), false);
  assert.equal(isSafeEditorUrl('/uploads/中文 图片.png', true), true);
  const image = markdownForMedia({ url: '/uploads/中文 (图).png', name: '图[片]\\一.png', mime: 'image/png' });
  assert.equal(image, '![图\\[片\\]\\\\一.png](</uploads/中文%20(图).png>)');
  const link = applyMarkdownCommand('中文', 0, 2, 'link', { url: 'https://example.com/a(b)', label: '描[述]' });
  assert.equal(link.text, '[描\\[述\\]](<https://example.com/a(b)>)');
  assert.equal(link.text.slice(link.start, link.end), '描\\[述\\]');
  assert.equal(markdownForMedia({ url: '/uploads/song.mp3', name: '歌曲', mime: 'audio/mpeg' }), '[歌曲](</uploads/song.mp3>)');
  assert.equal(markdownForMedia({ url: '/uploads/image.png', name: '<img>*a*|b.png', mime: 'image/png' }), '![\\<img\\>\\*a\\*\\|b.png](</uploads/image.png>)');
});

test('回车延续有序、无序、任务列表和引用，空条目退出且代码中不续写', () => {
  for (const [input, expected] of [['- 中文', '- 中文\n- '], ['9. 中文', '9. 中文\n10. '], ['- [x] 完成', '- [x] 完成\n- [ ] '], ['> 引用', '> 引用\n> '], ['> - 嵌套', '> - 嵌套\n> - ']]) {
    const next = continueMarkdownList(input, input.length, input.length)!;
    assert.equal(next.text, expected); assert.equal(next.start, expected.length); assert.equal(next.end, expected.length);
  }
  assert.equal(continueMarkdownList('- 一\n- ', 6, 6)?.text, '- 一\n');
  assert.equal(continueMarkdownList('> ', 2, 2)?.text, '');
  assert.equal(continueMarkdownList('> - ', 4, 4)?.text, '> ');
  assert.equal(continueMarkdownList('````js\n- example', 16, 16), null);
  const fenced = '```js\n```not-a-closing-fence\n- example';
  assert.equal(continueMarkdownList(fenced, fenced.length, fenced.length), null);
  assert.equal(continueMarkdownList('普通段落', 4, 4), null);
  assert.equal(continueMarkdownList('- 选中文字', 2, 4), null);
  assert.equal(continueMarkdownList('- abcdef', 5, 5)?.text, '- abc\n- def');
});

test('Tab和ShiftTab缩进、反缩进保留文本与可用选择', () => {
  assert.deepEqual(indentMarkdown('中文', 1, 1), { text: '中  文', start: 3, end: 3 });
  const indented = indentMarkdown('一\n二\n三', 0, 4);
  assert.equal(indented.text, '  一\n  二\n三');
  assert.equal(indentMarkdown(indented.text, indented.start, indented.end, true).text, '一\n二\n三');
  assert.deepEqual(indentMarkdown('  文本', 4, 4, true), { text: '文本', start: 2, end: 2 });
  assert.equal(applyMarkdownCommand('文字', 900, -20, 'bold').text, '**文字**');
});
