'use client';
export default function Error({ reset }: { error: Error; reset: () => void }) { return <div className="page-container not-found"><h1>页面加载失败</h1><p>请重试。</p><button className="button button-primary" onClick={reset}>重新加载</button></div>; }
