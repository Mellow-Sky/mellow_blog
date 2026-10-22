export const DEFAULT_HERO_IMAGE = '/images/hero.svg';
export const DEFAULT_HERO_IMAGE_ALT = '青蓝色山丘与日光的抽象插画';

export function isBrandingImageSource(value: string): boolean {
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}
