import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Maximize2,
  Minimize2,
  Presentation,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  DRIVE_SHARING_HINT,
  isGoogleDriveUrl,
  isValidDriveOrHttpsUrl,
  toDriveExternalUrl,
  toDrivePreviewUrl,
  validateDriveOrHttpsUrl,
} from '../lib/driveUtils';

export type DriveDocumentKind = 'docs' | 'sheets' | 'slides' | 'pdf' | 'external';
export type DriveViewerAspect = 'auto' | '16:9' | '4:3' | 'document';

export interface DriveDocumentViewerProps {
  url: string | null;
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  mode?: 'modal' | 'inline';
  aspect?: DriveViewerAspect;
  className?: string;
}

interface DocumentKindMeta {
  kind: DriveDocumentKind;
  label: string;
  shortLabel: string;
  badgeClass: string;
  inlineFrameClass: string;
}

function detectDocumentKind(rawUrl: string): DocumentKindMeta {
  const lower = rawUrl.toLowerCase();

  if (lower.includes('docs.google.com/document/')) {
    return {
      kind: 'docs',
      label: 'Google Docs Preview',
      shortLabel: 'Docs',
      badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      inlineFrameClass: 'min-h-[440px] sm:min-h-[580px] lg:min-h-[660px]',
    };
  }

  if (lower.includes('docs.google.com/spreadsheets/')) {
    return {
      kind: 'sheets',
      label: 'Google Sheets Preview',
      shortLabel: 'Sheets',
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      inlineFrameClass: 'min-h-[420px] sm:min-h-[540px] lg:min-h-[600px]',
    };
  }

  if (lower.includes('docs.google.com/presentation/')) {
    return {
      kind: 'slides',
      label: 'Google Slides Preview',
      shortLabel: 'Slides',
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      inlineFrameClass: 'aspect-video min-h-[260px] sm:min-h-[380px]',
    };
  }

  if (isGoogleDriveUrl(rawUrl)) {
    return {
      kind: 'pdf',
      label: 'Google Drive PDF / File Preview',
      shortLabel: 'Drive PDF',
      badgeClass: 'bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64] border-[#00EA64]/35',
      inlineFrameClass: 'min-h-[460px] sm:min-h-[600px] lg:min-h-[680px]',
    };
  }

  return {
    kind: 'external',
    label: 'External Document Preview',
    shortLabel: 'Document',
    badgeClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
    inlineFrameClass: 'min-h-[440px] sm:min-h-[560px]',
  };
}

function getInlineFrameClass(aspect: DriveViewerAspect, kindMeta: DocumentKindMeta): string {
  if (aspect === '16:9') return 'aspect-video min-h-[260px]';
  if (aspect === '4:3') return 'aspect-[4/3] min-h-[320px]';
  if (aspect === 'document') return 'min-h-[480px] sm:min-h-[640px]';
  return kindMeta.inlineFrameClass;
}

const DocumentKindIcon: React.FC<{ kind: DriveDocumentKind; className?: string }> = ({
  kind,
  className = 'w-4 h-4',
}) => {
  if (kind === 'sheets') return <FileSpreadsheet className={className} aria-hidden="true" />;
  if (kind === 'slides') return <Presentation className={className} aria-hidden="true" />;
  return <FileText className={className} aria-hidden="true" />;
};

export const DriveDocumentViewer: React.FC<DriveDocumentViewerProps> = ({
  url,
  title = 'Document Viewer',
  subtitle,
  onClose,
  mode,
  aspect = 'auto',
  className = '',
}) => {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [slowLoadHint, setSlowLoadHint] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const resolvedMode = mode ?? (onClose ? 'modal' : 'inline');
  const isModalOrExpanded = resolvedMode === 'modal' || expanded;

  useEffect(() => {
    if (!url) return;
    setIframeLoaded(false);
    setSlowLoadHint(false);
    setReloadKey(0);
  }, [url]);

  useEffect(() => {
    if (!url || iframeLoaded) {
      setSlowLoadHint(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setSlowLoadHint(true);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [url, iframeLoaded, reloadKey]);

  useEffect(() => {
    if (!url || !isModalOrExpanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (expanded && resolvedMode === 'inline') {
          setExpanded(false);
        } else if (onClose) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [url, onClose, isModalOrExpanded, expanded, resolvedMode]);

  const resolved = useMemo(() => {
    if (!url) return null;
    const isSafeUrl = isValidDriveOrHttpsUrl(url);
    const validation = validateDriveOrHttpsUrl(url, { allowEmpty: false, allowRelative: true });
    const valid = isSafeUrl && validation.valid;
    return {
      valid,
      validation,
      previewUrl: valid ? toDrivePreviewUrl(url) : '',
      externalUrl: valid ? toDriveExternalUrl(url) : '',
      isDrive: isGoogleDriveUrl(url),
      kindMeta: detectDocumentKind(url),
    };
  }, [url]);

  if (!url || !resolved) return null;

  const { valid, validation, previewUrl, externalUrl, isDrive, kindMeta } = resolved;

  const containerSizeClass = isModalOrExpanded
    ? expanded
      ? 'w-full h-[96dvh] max-w-[98vw]'
      : 'w-full max-w-5xl h-[90dvh] sm:h-[88vh]'
    : 'w-full';

  const frameWrapperClass = isModalOrExpanded
    ? 'relative flex-1 min-h-0 w-full bg-slate-100 dark:bg-[#0B0F14]'
    : `relative w-full bg-slate-100 dark:bg-[#0B0F14] ${getInlineFrameClass(aspect, kindMeta)}`;

  const handleReload = () => {
    setIframeLoaded(false);
    setSlowLoadHint(false);
    setReloadKey((prev) => prev + 1);
  };

  const handleCopyExternalLink = async () => {
    if (!externalUrl) return;
    try {
      await navigator.clipboard.writeText(externalUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard blocked in restricted iframe contexts
    }
  };

  const viewerCard = (
    <div
      className={`${containerSizeClass} bg-white dark:bg-[#121821] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${className}`}
    >
      {/* Toolbar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-slate-50 dark:bg-[#0B0F14] border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-lg bg-[#00EA64]/15 border border-[#00EA64]/35 flex items-center justify-center shrink-0 text-[#009942] dark:text-[#00EA64]">
            <DocumentKindIcon kind={kindMeta.kind} className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white truncate">
                {title}
              </h3>
              <span
                className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono font-semibold shrink-0 ${kindMeta.badgeClass}`}
              >
                {kindMeta.shortLabel}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
              {isDrive && (
                <ShieldCheck
                  className="w-3 h-3 text-[#009942] dark:text-[#00EA64] shrink-0"
                  aria-hidden="true"
                />
              )}
              <span className="truncate">
                {kindMeta.label}
                {subtitle ? ` · ${subtitle}` : ''}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {valid && previewUrl && (
            <button
              type="button"
              onClick={handleReload}
              title="Reload document preview"
              aria-label="Reload document preview"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161F2B] text-slate-600 dark:text-slate-300 hover:border-[#00EA64] hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}

          {valid && externalUrl && (
            <button
              type="button"
              onClick={handleCopyExternalLink}
              title="Copy document link"
              aria-label="Copy document link"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161F2B] text-slate-600 dark:text-slate-300 hover:border-[#00EA64] hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
              ) : (
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            title={expanded ? 'Exit expanded view' : 'Expand viewer'}
            aria-label={expanded ? 'Exit expanded view' : 'Expand viewer'}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161F2B] text-slate-600 dark:text-slate-300 hover:border-[#00EA64] hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {expanded ? (
              <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>

          {valid && externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] text-xs font-mono font-bold transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">
                {isDrive ? 'Open in Drive' : 'Open Link'}
              </span>
            </a>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close document viewer"
              className="p-2 rounded-lg bg-slate-200/80 dark:bg-[#1A2332] hover:bg-slate-300 dark:hover:bg-[#232D3F] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Sharing Hint Notice */}
      {isDrive && valid && (
        <div className="px-4 sm:px-5 py-2 bg-amber-500/5 dark:bg-[#161F2B] border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" aria-hidden="true" />
          <span className="leading-snug">
            If the embed appears blank, verify sharing is set to {DRIVE_SHARING_HINT} — or click{' '}
            &ldquo;Open in Drive&rdquo;.
          </span>
        </div>
      )}

      {/* Responsive Iframe Container or Validation Fallback */}
      <div className={frameWrapperClass}>
        {!valid ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center space-y-3">
            <AlertCircle className="w-9 h-9 text-amber-500 dark:text-amber-400" aria-hidden="true" />
            <h4 className="font-mono text-sm font-bold text-slate-900 dark:text-white">
              Unable to Preview Document Link
            </h4>
            <p className="text-xs font-mono text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
              {validation.error ||
                'This link is not a valid Google Drive file or HTTPS document URL.'}
            </p>
            <p className="text-[11px] font-mono text-slate-500">{DRIVE_SHARING_HINT}</p>
          </div>
        ) : (
          <>
            {!iframeLoaded && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center bg-slate-50/95 dark:bg-[#0B0F14]/95 text-slate-600 dark:text-slate-300 font-mono text-xs gap-3">
                <div className="w-6 h-6 border-2 border-[#00EA64] border-t-transparent rounded-full animate-spin" />
                <span>Loading {kindMeta.label.toLowerCase()}...</span>
                {slowLoadHint && externalUrl && (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleReload}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] hover:border-[#00EA64]"
                    >
                      Retry Embed
                    </button>
                    <a
                      href={externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-[#00EA64] text-[#0B0F14] text-[11px] font-bold"
                    >
                      Open in Drive
                    </a>
                  </div>
                )}
              </div>
            )}
            <iframe
              key={`${previewUrl}::${reloadKey}`}
              src={previewUrl}
              title={title}
              loading="lazy"
              referrerPolicy="no-referrer"
              allow="autoplay; fullscreen"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation"
              onLoad={() => setIframeLoaded(true)}
              className="absolute inset-0 w-full h-full border-0 z-10 bg-white"
            />
          </>
        )}
      </div>
    </div>
  );

  if (!isModalOrExpanded) {
    return viewerCard;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (expanded && resolvedMode === 'inline') {
            setExpanded(false);
          } else if (onClose) {
            onClose();
          }
        }
      }}
    >
      {viewerCard}
    </div>
  );
};

export default DriveDocumentViewer;
