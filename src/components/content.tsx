import rehypeHighlight from 'rehype-highlight';
import { ContentImage } from './content-image';
import { evaluate } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { remarkSafeMdx } from '@/lib/mdx-safety';
import { headingId } from '@/lib/utils';
import { withoutSummaryMarkers } from '@/lib/markdown-summary';
function textFromChildren(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textFromChildren).join('');
  if (children && typeof children === 'object' && 'props' in children) return textFromChildren((children.props as { children?: ReactNode }).children);
  return '';
}
function Callout({ children, title }: { children?: ReactNode; title?: string }) { return <aside className="content-callout">{title && <strong>{title}</strong>}{children}</aside>; }
const components = {
  pre: ({ children }: { children?: ReactNode }) => <pre tabIndex={0} aria-label="代码块，可使用方向键横向滚动">{children}</pre>,
  h1: ({ children }: { children?: ReactNode }) => <h1 id={headingId(textFromChildren(children))}>{children}</h1>,
  h2: ({ children }: { children?: ReactNode }) => <h2 id={headingId(textFromChildren(children))}>{children}</h2>,
  h3: ({ children }: { children?: ReactNode }) => <h3 id={headingId(textFromChildren(children))}>{children}</h3>,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}>{children}</a>,
  img: ({ src, alt }: { src?: string | Blob; alt?: string }) => typeof src === 'string' ? <ContentImage src={src} alt={alt} /> : null,
};
export function MarkdownContent({ source }: { source: string }) { return <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize, [rehypeHighlight, { detect: false, ignoreMissing: true }]]} components={components}>{source}</ReactMarkdown>; }
export async function ArticleContent({ source, format }: { source: string; format: string }) {
  if (format !== 'mdx') return <MarkdownContent source={source} />;
  try {
    if (source.length > 300000) throw new Error('MDX 超出长度限制');
    const { default: Content } = await evaluate(withoutSummaryMarkers(source), { ...runtime, remarkPlugins: [remarkGfm, remarkSafeMdx], rehypePlugins: [[rehypeHighlight, { detect: false, ignoreMissing: true }]] });
    return <Content components={{ ...components, Callout, Note: Callout }} />;
  } catch {
    return <><div className="content-callout">这篇 MDX 包含不受支持的语法，已以安全 Markdown 显示。</div><MarkdownContent source={source} /></>;
  }
}
