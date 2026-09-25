import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BASE_URL = 'https://www.gesturestudio.in';

/**
 * Normalizes a pathname to a clean canonical URL:
 * - '/' becomes 'https://www.gesturestudio.in/'
 * - '/privacy-policy/' or '/privacy-policy' becomes 'https://www.gesturestudio.in/privacy-policy'
 */
function getCanonicalUrl(pathname) {
  if (!pathname || pathname === '/') {
    return `${BASE_URL}/`;
  }
  // Strip trailing slashes
  const cleanPath = pathname.replace(/\/+$/, '');
  return `${BASE_URL}${cleanPath}`;
}

export default function CanonicalManager() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const canonicalUrl = getCanonicalUrl(pathname);

    // 1. Update or create <link rel="canonical">
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonicalUrl);

    // 2. Update or create <meta property="og:url">
    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute('content', canonicalUrl);

    // 3. Update or create <meta name="twitter:url">
    let twitterUrl = document.querySelector('meta[name="twitter:url"]');
    if (!twitterUrl) {
      twitterUrl = document.createElement('meta');
      twitterUrl.setAttribute('name', 'twitter:url');
      document.head.appendChild(twitterUrl);
    }
    twitterUrl.setAttribute('content', canonicalUrl);
  }, [pathname]);

  return null;
}
