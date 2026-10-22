import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Coffee, Feather, Headphones } from 'lucide-react';
import { getPosts, getSettings, getTaxonomies } from '@/lib/db';
import { Magnetic, Parallax, Reveal } from '@/components/motion';
import { PostFeed } from '@/components/post-feed';
import { HeroImage } from '@/components/hero-image';
import { DEFAULT_HERO_IMAGE, DEFAULT_HERO_IMAGE_ALT } from '@/lib/branding';
import { visibleSiteLinks } from '@/lib/site-customization';
import { SiteLink } from '@/components/site-link';

export const dynamic = 'force-dynamic';

export default function Home() {
  const posts = getPosts(), settings = getSettings(), taxonomies = getTaxonomies();
  const sidebarLinks = visibleSiteLinks(settings.sidebarLinks, settings.bangumiEnabled);
  const hasSidebar = settings.homeShowAuthorCard || (settings.homeShowSidebarLinks && sidebarLinks.length > 0);
  return <div className="home-container">
    <section className="hero">
      <div className="hero-copy"><Reveal>
        <h1>{settings.heroTitle || '记录与分享'}</h1>
        {settings.heroSubtitle && <p>{settings.heroSubtitle}</p>}
        <div className="hero-actions">
          {settings.heroShowPrimaryButton && <Magnetic className="button button-primary" href={settings.heroPrimaryHref}>{settings.labels.browsePosts} <ArrowDown size={18} /></Magnetic>}
          {settings.heroShowSecondaryButton && <SiteLink className="text-link" href={settings.heroSecondaryHref}>{settings.labels.aboutMe} <ArrowUpRight size={18} /></SiteLink>}
        </div>
      </Reveal></div>
      <div className="hero-visual">
        <Parallax className="hero-image-frame" speed={60}>
          <HeroImage src={settings.heroImage || DEFAULT_HERO_IMAGE} alt={settings.heroImageAlt ?? DEFAULT_HERO_IMAGE_ALT} />
        </Parallax>
      </div>
    </section>
    {settings.homeShowAnnouncement && settings.announcement && <div className="welcome-strip"><span><span className="announcement-icon"><Coffee size={17} /></span>{settings.announcement}</span><Link href="/archives">{settings.labels.archiveTitle} <ArrowRight size={17} /></Link></div>}
    <div className={`content-with-sidebar${hasSidebar ? '' : ' no-sidebar'}`}>
      <PostFeed posts={posts} taxonomies={taxonomies} labels={settings.labels} />
      {hasSidebar && <aside className="home-sidebar">
        {settings.homeShowAuthorCard && <Reveal><section className="author-card">
          <div className="author-banner" aria-hidden />
          <div className="author-avatar"><Image unoptimized={/^https?:/.test(settings.avatar)} src={settings.avatar || '/avatar.svg'} alt={`${settings.author}的头像`} width={76} height={76} /></div>
          <h2>{settings.author || '博主'}</h2>
          {settings.description && <p>{settings.description}</p>}
          <div className="author-stats">
            <Link href="/archives"><strong>{posts.length}</strong><span>文章</span></Link>
            <Link href="/archives"><strong>{taxonomies.filter(t => t.type === 'category').length}</strong><span>分类</span></Link>
            <Link href="/archives"><strong>{taxonomies.filter(t => t.type === 'tag').length}</strong><span>标签</span></Link>
          </div>
          <Link className="author-more" href="/about">{settings.labels.aboutMe} <ArrowUpRight size={17} /></Link>
        </section></Reveal>}
        {settings.homeShowSidebarLinks && sidebarLinks.length > 0 && <section className="sidebar-links">
          <div className="small-section-title"><span>导航</span></div>
          {sidebarLinks.map(item => <SiteLink key={item.id} href={item.href} newTab={item.newTab}><span><BookOpen size={18} />{item.label}</span><ArrowUpRight size={17} /></SiteLink>)}
        </section>}
      </aside>}
    </div>
  </div>;
}
