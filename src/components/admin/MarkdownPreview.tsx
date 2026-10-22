'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

export default function MarkdownPreview({ content }: { content: string }) {
  return <div className="admin-markdown"><Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} skipHtml>{content || '*你的文字，会在这里慢慢成形。*'}</Markdown></div>;
}
