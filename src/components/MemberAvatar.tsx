import React, { memo, useEffect, useState } from 'react';
import { UserRole } from '../config/rbacAndData';
import {
  extractDriveFileId,
  toDriveImageUrl,
  toDriveThumbnailUrl,
} from '../lib/driveUtils';

export function getMemberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'HC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function normalizeDisplayPhotoUrl(raw?: string | null): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/src/')) return trimmed.slice(0, 500);

  const driveNormalized = toDriveImageUrl(trimmed);
  try {
    const parsed = new URL(driveNormalized);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return driveNormalized.slice(0, 500);
    }
  } catch {
    return '';
  }
  return '';
}

interface MemberAvatarProps {
  name: string;
  photoUrl?: string | null;
  variant?: Exclude<UserRole, 'outsider'>;
  sizeClass?: string;
  roundedClass?: string;
  textClass?: string;
  className?: string;
}

/**
 * Renders a member portrait from their user-supplied or Google Drive image URL
 * with referrer protection, multi-stage Drive URL fallback (lh3 -> thumbnail),
 * and an automatic initials fallback.
 */
export const MemberAvatar: React.FC<MemberAvatarProps> = memo(({
  name,
  photoUrl,
  variant = 'member',
  sizeClass = 'w-14 h-14',
  roundedClass = 'rounded-xl',
  textClass = 'text-base',
  className = '',
}) => {
  const primaryUrl = normalizeDisplayPhotoUrl(photoUrl);
  const driveId = extractDriveFileId(photoUrl);
  const thumbnailUrl = driveId ? toDriveThumbnailUrl(photoUrl, 1000) : '';

  const [stage, setStage] = useState<'primary' | 'thumbnail' | 'fallback'>(
    primaryUrl ? 'primary' : 'fallback'
  );

  useEffect(() => {
    setStage(primaryUrl ? 'primary' : 'fallback');
  }, [primaryUrl]);

  const activeUrl =
    stage === 'primary'
      ? primaryUrl
      : stage === 'thumbnail'
        ? thumbnailUrl
        : '';

  const fallbackPalette =
    variant === 'lead'
      ? 'bg-[#00EA64]/15 border-[#00EA64]/45 text-[#009942] dark:text-[#00EA64]'
      : variant === 'crew'
        ? 'bg-sky-500/10 border-sky-500/35 text-sky-700 dark:text-sky-300'
        : 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200';

  if (stage !== 'fallback' && activeUrl) {
    return (
      <div
        className={`${sizeClass} ${roundedClass} overflow-hidden border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-[#0B0F14] shrink-0 ${className}`}
      >
        <img
          key={activeUrl}
          src={activeUrl}
          alt={`${name} profile`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (stage === 'primary' && thumbnailUrl && thumbnailUrl !== primaryUrl) {
              setStage('thumbnail');
            } else {
              setStage('fallback');
            }
          }}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`${name} avatar`}
      className={`${sizeClass} ${roundedClass} border ${fallbackPalette} flex items-center justify-center font-mono ${textClass} font-bold shrink-0 ${className}`}
    >
      {getMemberInitials(name)}
    </div>
  );
});

MemberAvatar.displayName = 'MemberAvatar';
