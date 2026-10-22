import Link from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { isInternalSiteLink, isSafeSiteLink } from '@/lib/site-customization';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; newTab?: boolean; children: ReactNode };
export function SiteLink({ href, newTab = false, children, ...props }: Props) {
  if (!isSafeSiteLink(href)) return null;
  const target = newTab ? '_blank' : undefined;
  const rel = newTab ? 'noopener noreferrer' : undefined;
  return isInternalSiteLink(href) ? <Link {...props} href={href} target={target} rel={rel}>{children}</Link> : <a {...props} href={href} target={target} rel={rel}>{children}</a>;
}
