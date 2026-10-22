import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanExcerpt, postExcerpt } from '../src/lib/utils';

// Synthetic Markdown and generated previews exercise compatibility without real posts.
const articleSample = {
  content: ' **示例标题** \r\n 第一段说明一个测试场景。\r\n\r\n![sample-diagram.png](https://images.example.com/sample-diagram.png)\r\n\r\n 图片之后保留 1e9 和普通文字。\r\n\r\n [示例文档](https://example.com/docs) \r\n\r\n *结束说明：* \r\n',
  excerpt: '示例标题 第一段说明一个测试场景。 sample-diagram.png 图片之后保留 1e9 和普通文字。 示例文档 结束说明：',
};
const stepsSample = {
  content: '# 示例步骤\r\n\r\n## 1.准备内容\r\n\r\n![sample-step](/uploads/sample-step.png)\r\n\r\n# 查看结果\r\n\r\n#### 使用 id、status 和 total 字段\r\n\r\n#### 使用 `ctrl + f` 查找文本\r\n\r\n###### 最后保存测试结果\r\n',
  excerpt: '示例步骤 1.准备内容 sample-step 查看结果 使用 id、status 和 total 字段 使用 ctrl + f 查找文本 最后保存测试结果',
};

test('旧自动摘要从示例原文重新生成，不把图片 alt 当正文', () => {
  assert.match(articleSample.excerpt, /sample-diagram\.png/);
  assert.match(stepsSample.excerpt, /sample-step/);
  const first = postExcerpt(articleSample), second = postExcerpt(stepsSample);
  assert.equal(first, '示例标题 第一段说明一个测试场景。 图片之后保留 1e9 和普通文字。 示例文档 结束说明：');
  assert.equal(second, '示例步骤 1.准备内容 查看结果 使用 id、status 和 total 字段 使用 ctrl + f 查找文本 最后保存测试结果');
});

test('移除整张行内图片，包括空 alt、转义括号、嵌套 alt、带空格地址及可选标题', () => {
  for (const image of [
    '![](/uploads/photo.png)',
    '![图片文件名.png](https://example.com/a(b).png)',
    '![含 [方括号] 的描述](https://example.com/photo.png "图的标题")',
    '![描述](<https://example.com/a b.png> "含 ) 的标题")',
    '![描述](/uploads/photo\\(1\\).png)',
    '[![点击图片](/uploads/photo.png)](https://example.com/full)',
  ]) assert.equal(cleanExcerpt(`前文 ${image} 后文`), '前文 后文', image);
});

test('引用式图片和定义一起去除，普通引用链接保留可读文本', () => {
  const value = '前文 ![截图][image] ![same][] ![shortcut] [官网][site] 后文\n\n[image]: <https://example.com/a b.png> "说明"\n[same]: /uploads/b.png\n[shortcut]: /uploads/c.png\n[site]: https://example.com';
  assert.equal(cleanExcerpt(value), '前文 官网 后文');
  assert.equal(cleanExcerpt('![missing][unknown]'), '![missing][unknown]');
});

test('HTML 和 MDX 图片、注释不泄漏属性，普通块和组件的实际文字保留', () => {
  const value = '<p>前文</p><!-- 隐藏 --> <img src="/uploads/a.png" alt="image-123" title="1 > 0"> <Image src="/uploads/b.png" alt="filename" /> <Callout tone="info">正文 &amp; 内容</Callout><p>后文</p>';
  assert.equal(cleanExcerpt(value), '前文 正文 & 内容 后文');
  assert.equal(cleanExcerpt('前文<script>alert("no")</script><style>body{color:red}</style>后文'), '前文 后文');
  assert.equal(cleanExcerpt('<p>欢迎<strong>回来</strong>，<a href="/about">关于</a>本站。</p>'), '欢迎回来，关于本站。');
});

test('正文普通链接保留标题，嵌套和括号地址不会留下 URL 碎片', () => {
  assert.equal(cleanExcerpt('[官方文档](https://example.com/a(b) "标题")、[**下载**](/archive.zip) 和 <https://example.com/docs>'), '官方文档、下载 和 https://example.com/docs');
  assert.equal(cleanExcerpt('[参考 [第一章]](/docs/chapter)'), '参考 [第一章]');
});

test('只删除 Markdown 格式标记，普通数学、标识符、井号和箭头保持完整', () => {
  assert.equal(cleanExcerpt('# 标题\n\n**加粗**，*斜体*，~~删除线~~\n> 引用\n- 列表'), '标题 加粗，斜体，删除线 引用 列表');
  const text = 'C# 与 snake_case、image-123、sample-diagram.png；2 * 3 * 4，a > b，x < y，{1, 2}，声音——>接收者 #';
  assert.equal(cleanExcerpt(text), text);
});

test('代码块不作为摘要，行内代码、转义和数学中的图片样例不被误当图片删除', () => {
  assert.equal(cleanExcerpt('前文\n```cpp\nstd::vector<int> v;\n![代码图片](/a.png)\n```\n后文'), '前文 后文');
  assert.equal(cleanExcerpt('前文\n~~~~md\n```\n![代码图片](/a.png)\n~~~~\n后文'), '前文 后文');
  assert.equal(cleanExcerpt('`std::vector<int>` 与 `x * y > z`，`![literal](/a.png)`，\\*字面星号\\*'), 'std::vector<int> 与 x * y > z，![literal](/a.png)，*字面星号*');
  assert.equal(cleanExcerpt('前文\n```\n未完成的代码'), '前文');
});

test('手写简介优先且不按文件名猜测删除；空简介跟随正文，纯图片返回空值供调用侧兜底', () => {
  assert.equal(postExcerpt({ ...articleSample, excerpt: '这里介绍示例内容，使用 sample-diagram.png 演示。' }), '这里介绍示例内容，使用 sample-diagram.png 演示。');
  assert.equal(postExcerpt({ ...stepsSample, excerpt: '手写简介 [文档](https://example.com) ![截图](/a.png)' }), '手写简介 文档');
  assert.equal(postExcerpt({ excerpt: '  ', content: '正文简介' }), '正文简介');
  assert.equal(postExcerpt({ excerpt: '', content: '![仅图片](/uploads/a.png)' }), '');
  assert.equal(postExcerpt({ excerpt: '仅图片', content: '![仅图片](/uploads/a.png)' }), '');
  assert.equal(cleanExcerpt('<img src="/a.png" alt="图片" />'), '');
});

test('旧自动摘要按 Unicode 字符精确匹配，不误判只有共同开头或被编辑过的简介', () => {
  const content = `${'🙂'.repeat(179)} ![filename](/a.png) 正文`, excerpt = `${'🙂'.repeat(179)} `;
  assert.equal(postExcerpt({ excerpt, content }), `${'🙂'.repeat(179)} 正文`);
  const authored = '手写摘要带图片说明';
  assert.equal(postExcerpt({ excerpt: authored, content: `正文内容 ${authored}` }), authored);
  assert.equal(postExcerpt({ ...articleSample, excerpt: `${articleSample.excerpt} 新增说明` }), `${articleSample.excerpt} 新增说明`);
});
