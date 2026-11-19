import React, { useState } from 'react';
import { Code2 } from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

/**
 * Resilient image component that ensures zero broken image frames if an external
 * or user-submitted photo URL fails to load.
 */
export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  fallbackTitle,
}) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
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
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
