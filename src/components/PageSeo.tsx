import React from 'react';
import { Helmet } from 'react-helmet';
import { CHAPTER_IMAGES } from '../config/rbacAndData';

export const SITE_NAME = 'HackerRank Campus Crew – Paavai Engineering College';
export const DEFAULT_KEYWORDS = [
  'HackerRank Campus Crew',
  'Paavai Engineering College',
  'Competitive Programming',
  'DSA Roadmap',
  'Coding Club',
  'Namakkal',
  'Hackathon',
  'Campus Leaderboard',
];

export function toAbsoluteUrl(urlOrPath?: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const value = (urlOrPath || '').trim();
  if (!value) {
    return origin ? `${origin}${CHAPTER_IMAGES.hero}` : CHAPTER_IMAGES.hero;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (value.startsWith('/')) {
    return origin ? `${origin}${value}` : value;
  }
  return origin ? `${origin}/${value}` : `/${value}`;
}

export function clampMetaDescription(raw: string, maxLength = 160): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  const slice = cleaned.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 80 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

export interface PageSeoProps {
  title: string;
  description: string;
  keywords?: string[];
  canonicalPath?: string;
  type?: 'website' | 'article' | 'profile';
  image?: string;
  imageAlt?: string;
  noIndex?: boolean;
  profile?: {
    firstName?: string;
    lastName?: string;
    username?: string;
  };
  article?: {
    publishedTime?: string;
    section?: string;
    tags?: string[];
  };
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

/**
 * Dynamic head manager powered by react-helmet for route-level SEO,
 * OpenGraph social cards, Twitter cards, canonical URLs, and Schema.org JSON-LD.
 */
export const PageSeo: React.FC<PageSeoProps> = ({
  title,
  description,
  keywords,
  canonicalPath,
  type = 'website',
  image,
  imageAlt,
  noIndex = false,
  profile,
  article,
  structuredData,
}) => {
  const origin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const currentPath =
    canonicalPath !== undefined
      ? canonicalPath
      : typeof window !== 'undefined'
        ? window.location.pathname
        : '/';
  const canonicalUrl = origin
    ? `${origin}${currentPath.startsWith('/') ? currentPath : `/${currentPath}`}`
    : currentPath;

  const fullTitle = title.includes('HackerRank Campus Crew')
    ? title
    : `${title} | HackerRank Campus Crew – Paavai`;
  const cleanDescription = clampMetaDescription(description);
  const resolvedImage = toAbsoluteUrl(image || CHAPTER_IMAGES.hero);
  const resolvedImageAlt = imageAlt || fullTitle;
  const mergedKeywords = Array.from(
    new Set([...(keywords || []), ...DEFAULT_KEYWORDS].filter(Boolean))
  ).join(', ');
  const robotsValue = noIndex ? 'noindex, nofollow' : 'index, follow';

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={cleanDescription} />
      <meta name="keywords" content={mergedKeywords} />
      <meta name="robots" content={robotsValue} />
      {!noIndex && canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* OpenGraph */}
      <meta property="og:type" content={type} />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={cleanDescription} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:image" content={resolvedImage} />
      <meta property="og:image:alt" content={resolvedImageAlt} />

      {type === 'profile' && profile?.username && (
        <meta property="profile:username" content={profile.username} />
      )}
      {type === 'profile' && profile?.firstName && (
        <meta property="profile:first_name" content={profile.firstName} />
      )}
      {type === 'profile' && profile?.lastName && (
        <meta property="profile:last_name" content={profile.lastName} />
      )}

      {type === 'article' && article?.publishedTime && (
        <meta property="article:published_time" content={article.publishedTime} />
      )}
      {type === 'article' && article?.section && (
        <meta property="article:section" content={article.section} />
      )}

      {/* Twitter / X Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={cleanDescription} />
      <meta name="twitter:image" content={resolvedImage} />

      {/* Schema.org Structured Data */}
      {structuredData && (
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      )}
    </Helmet>
  );
};
