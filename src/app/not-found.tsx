import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
export default function NotFound() { return <div className="not-found page-container"><Sparkles size={36} aria-hidden /><span className="eyebrow">404</span><h1>页面未找到</h1><p>链接可能已失效。</p><Link className="button button-primary" href="/"><ArrowLeft size={18} /> 返回首页</Link></div>; }
