type AstNode = { type?: string; name?: string; value?: string; url?: string; attributes?: { type: string; name?: string; value?: unknown }[]; children?: AstNode[] };
const tags = new Set(['Callout', 'Note', 'h1','h2','h3','h4','h5','h6','p','a','img','ul','ol','li','strong','em','del','blockquote','pre','code','table','thead','tbody','tr','th','td','hr','br','details','summary','kbd','mark','sup','sub']);
const attributes = new Set(['title','href','src','alt','width','height','start','open','type','id']);
export function isSafeContentUrl(url: string) { return !url || /^(https?:\/\/|mailto:|#|\/(?!\/))/.test(url); }
export function validateMdxTree(tree: AstNode) {
  let count = 0;
  const visit = (node: AstNode, depth = 0) => {
    if (++count > 20000 || depth > 100) throw new Error('MDX 内容过于复杂');
    if (['mdxjsEsm','mdxFlowExpression','mdxTextExpression'].includes(node.type || '')) throw new Error('MDX 不支持 JavaScript 表达式、import 或 export，请使用纯文本组件属性。');
    if (node.url && !isSafeContentUrl(node.url)) throw new Error('不支持的链接协议');
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      if (node.name && !tags.has(node.name)) throw new Error(`不支持的 MDX 组件：${node.name}`);
      for (const attr of node.attributes || []) {
        if (attr.type !== 'mdxJsxAttribute' || !attr.name || !attributes.has(attr.name) || (attr.value !== null && typeof attr.value !== 'string')) throw new Error('MDX 仅支持白名单纯文本属性，不支持事件、展开或表达式属性。');
        if (['src','href'].includes(attr.name) && !isSafeContentUrl(String(attr.value || ''))) throw new Error('MDX 链接需要使用 http(s)、站内地址或邮箱。');
      }
    }
    for (const child of node.children || []) visit(child, depth + 1);
  };
  visit(tree);
}
export function remarkSafeMdx() { return validateMdxTree; }
