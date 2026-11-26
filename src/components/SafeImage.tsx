import React, { memo, useEffect, useState } from 'react';
import { Code2 } from 'lucide-react';
import {
  extractDriveFileId,
  toDriveImageUrl,
  toDriveThumbnailUrl,
} from '../lib/driveUtils';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  /** Set true for above-the-fold LCP hero images to load eagerly with high fetch priority */
  priority?: boolean;
}

/**
 * Resilient image component that automatically normalizes Google Drive links,
 * falls back from lh3.googleusercontent.com -> drive.google.com/thumbnail ->
 * clean UI placeholder, enforces referrerPolicy="no-referrer", and lazy-loads
 * offscreen images with async decoding.
 */
export const SafeImage: React.FC<SafeImageProps> = memo(({
  src,
  alt,
  className = '',
  fallbackTitle,
  priority = false,
}) => {
  const normalizedPrimary = toDriveImageUrl(src);
  const driveId = extractDriveFileId(src);
  const thumbnailFallback = driveId ? toDriveThumbnailUrl(src, 1000) : '';

  const [stage, setStage] = useState<'primary' | 'thumbnail' | 'failed'>('primary');

  useEffect(() => {
    setStage(normalizedPrimary ? 'primary' : 'failed');
  }, [normalizedPrimary]);

  const activeSrc =
    stage === 'primary'
      ? normalizedPrimary
      : stage === 'thumbnail'
        ? thumbnailFallback
        : '';

  if (stage === 'failed' || !activeSrc) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-slate-200 dark:bg-[#121821] text-slate-500 dark:text-slate-400 p-4 text-center ${className}`}
      >
        <Code2 className="w-7 h-7 text-[#00EA64] mb-2" aria-hidden="true" />
        <span className="font-mono text-xs font-medium line-clamp-2">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      key={activeSrc}
      src={activeSrc}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      referrerPolicy="no-referrer"
      onError={() => {
        if (stage === 'primary' && thumbnailFallback && thumbnailFallback !== normalizedPrimary) {
          setStage('thumbnail');
        } else {
          setStage('failed');
        }
      }}
      className={className}
    />
  );
});

SafeImage.displayName = 'SafeImage';
