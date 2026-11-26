/**
 * Universal Google Drive Image & Document Link Engine
 * Normalizes any Google Drive or Docs/Sheets/Slides share link into direct
 * embeddable image URLs, fallback thumbnail URLs, and iframe preview URLs.
 */

export const DRIVE_SHARING_HINT =
  "Set Google Drive sharing to 'Anyone with the link → Viewer'";

const DRIVE_FILE_PATTERNS: RegExp[] = [
  // https://drive.google.com/(a/<domain>/)?file/(u/0/)?d/<FILE_ID>/view...
  /drive\.google\.com\/(?:a\/[^/]+\/)?file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{10,})/i,
  // https://drive.google.com/open?id=<FILE_ID>, /uc?id=<FILE_ID>, /thumbnail?id=<FILE_ID>, or drive.usercontent.google.com
  /drive(?:\.usercontent)?\.google\.com\/(?:a\/[^/]+\/)?(?:u\/\d+\/)?(?:open|uc|thumbnail|download)\?(?:[^#]*&)?id=([a-zA-Z0-9_-]{10,})/i,
  // https://docs.google.com/(a/<domain>/)?(document|spreadsheets|presentation)/d/e/<PUB_ID>/...
  /docs\.google\.com\/(?:a\/[^/]+\/)?(?:document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/e\/([a-zA-Z0-9_-]{10,})/i,
  // https://docs.google.com/(a/<domain>/)?(document|spreadsheets|presentation|drawings|forms)/(u/0/)?d/<FILE_ID>/...
  /docs\.google\.com\/(?:a\/[^/]+\/)?(?:document|spreadsheets|presentation|drawings|forms)\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{10,})/i,
  // https://lh3.googleusercontent.com/d/<FILE_ID>
  /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/i,
];

/**
 * Extracts a Google Drive File ID from standard Drive, Docs, Sheets, Slides,
 * Google Workspace (/a/<domain>/...), uc, open, thumbnail, usercontent, or lh3 links.
 * Returns null if not a Drive link.
 */
export function extractDriveFileId(rawUrl?: string | null): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;

  for (const pattern of DRIVE_FILE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Returns true if the URL points to Google Drive or Google Docs hosts.
 */
export function isGoogleDriveUrl(rawUrl?: string | null): boolean {
  const trimmed = (rawUrl || '').trim().toLowerCase();
  if (!trimmed) return false;
  return (
    trimmed.includes('drive.google.com') ||
    trimmed.includes('drive.usercontent.google.com') ||
    trimmed.includes('docs.google.com') ||
    trimmed.includes('lh3.googleusercontent.com/d/')
  );
}

/**
 * Converts a Drive file link into the primary direct-embed image URL
 * (`https://lh3.googleusercontent.com/d/<FILE_ID>`), passing through
 * non-Drive https:// (or safe relative `/`) URLs cleanly.
 */
export function toDriveImageUrl(rawUrl?: string | null): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';

  const fileId = extractDriveFileId(trimmed);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return trimmed;
}

/**
 * Secondary Google Drive image URL fallback (`drive.google.com/thumbnail`).
 */
export function toDriveThumbnailUrl(rawUrl?: string | null, width = 1000): string {
  const fileId = extractDriveFileId(rawUrl);
  if (!fileId) return '';
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
}

/**
 * Returns an ordered list of image URLs to try for resilient rendering:
 * For Drive links: [lh3.googleusercontent.com/d/<ID>, drive.google.com/thumbnail?id=<ID>&sz=w1000]
 * For non-Drive links: [trimmedUrl]
 */
export function getDriveImageFallbackChain(rawUrl?: string | null, width = 1000): string[] {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return [];

  const fileId = extractDriveFileId(trimmed);
  if (fileId) {
    return [
      `https://lh3.googleusercontent.com/d/${fileId}`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`,
    ];
  }

  return [trimmed];
}

/**
 * Converts any Drive file/PDF/Docs/Sheets/Slides link into an embeddable
 * preview URL for inline iframe viewing.
 */
export function toDrivePreviewUrl(rawUrl?: string | null): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';

  // Handle Google Docs/Sheets/Slides "Publish to the web" (/d/e/<PUB_ID>/...) URLs
  const publishedMatch = trimmed.match(
    /docs\.google\.com\/(?:a\/[^/]+\/)?(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/e\/([a-zA-Z0-9_-]{10,})/i
  );
  if (publishedMatch?.[1] && publishedMatch?.[2]) {
    const kind = publishedMatch[1].toLowerCase();
    const pubId = publishedMatch[2];
    if (kind === 'presentation') {
      return `https://docs.google.com/presentation/d/e/${pubId}/embed?start=false&loop=false&delayms=3000`;
    }
    if (kind === 'spreadsheets') {
      return `https://docs.google.com/spreadsheets/d/e/${pubId}/pubhtml?widget=true&headers=false`;
    }
    return `https://docs.google.com/document/d/e/${pubId}/pub?embedded=true`;
  }

  // Handle Google Docs/Sheets/Slides specifically so native interactive previews work cleanly
  const docsMatch = trimmed.match(
    /docs\.google\.com\/(?:a\/[^/]+\/)?(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{10,})/i
  );
  if (docsMatch?.[1] && docsMatch?.[2]) {
    return `https://docs.google.com/${docsMatch[1].toLowerCase()}/d/${docsMatch[2]}/preview`;
  }

  const fileId = extractDriveFileId(trimmed);
  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }

  return trimmed;
}

/**
 * Canonical "Open in Google Drive" view URL.
 */
export function toDriveExternalUrl(rawUrl?: string | null): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';

  const publishedMatch = trimmed.match(
    /docs\.google\.com\/(?:a\/[^/]+\/)?(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/e\/([a-zA-Z0-9_-]{10,})/i
  );
  if (publishedMatch?.[1] && publishedMatch?.[2]) {
    const kind = publishedMatch[1].toLowerCase();
    const pubId = publishedMatch[2];
    return kind === 'spreadsheets'
      ? `https://docs.google.com/spreadsheets/d/e/${pubId}/pubhtml`
      : `https://docs.google.com/${kind}/d/e/${pubId}/pub`;
  }

  const docsMatch = trimmed.match(
    /docs\.google\.com\/(?:a\/[^/]+\/)?(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{10,})/i
  );
  if (docsMatch?.[1] && docsMatch?.[2]) {
    return `https://docs.google.com/${docsMatch[1].toLowerCase()}/d/${docsMatch[2]}/view`;
  }

  const fileId = extractDriveFileId(trimmed);
  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  return trimmed;
}

export interface DriveValidationResult {
  valid: boolean;
  isDrive: boolean;
  fileId: string | null;
  previewImageUrl: string;
  hint: string;
  error?: string;
}

/**
 * Validates whether a URL is either an empty string (when optional) or a valid
 * Google Drive link / standard https:// URL, returning inline helper hints.
 */
export function validateDriveOrHttpsUrl(
  rawUrl?: string | null,
  options: { allowEmpty?: boolean; allowRelative?: boolean } = {}
): DriveValidationResult {
  const { allowEmpty = true, allowRelative = false } = options;
  const trimmed = (rawUrl || '').trim();

  if (!trimmed) {
    return {
      valid: allowEmpty,
      isDrive: false,
      fileId: null,
      previewImageUrl: '',
      hint: DRIVE_SHARING_HINT,
      error: allowEmpty ? undefined : 'Please provide a Google Drive or https:// link.',
    };
  }

  if (allowRelative && trimmed.startsWith('/')) {
    return {
      valid: true,
      isDrive: false,
      fileId: null,
      previewImageUrl: trimmed,
      hint: 'Local asset path detected.',
    };
  }

  const driveDetected = isGoogleDriveUrl(trimmed);
  const fileId = extractDriveFileId(trimmed);

  if (driveDetected) {
    if (!fileId) {
      return {
        valid: false,
        isDrive: true,
        fileId: null,
        previewImageUrl: '',
        hint: DRIVE_SHARING_HINT,
        error:
          'Google Drive link is missing a valid file ID. Copy the share link via Share → Copy link (not a folder URL).',
      };
    }

    return {
      valid: true,
      isDrive: true,
      fileId,
      previewImageUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
      hint: `Google Drive File ID detected (${fileId.slice(0, 8)}…). ${DRIVE_SHARING_HINT}.`,
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        valid: false,
        isDrive: false,
        fileId: null,
        previewImageUrl: '',
        hint: DRIVE_SHARING_HINT,
        error: 'Only https:// URLs or Google Drive links are supported.',
      };
    }
    return {
      valid: true,
      isDrive: false,
      fileId: null,
      previewImageUrl: trimmed,
      hint: 'Direct HTTPS link verified.',
    };
  } catch {
    return {
      valid: false,
      isDrive: false,
      fileId: null,
      previewImageUrl: '',
      hint: DRIVE_SHARING_HINT,
      error: 'Enter a valid Google Drive share link or https:// URL.',
    };
  }
}

export function isValidDriveOrHttpsUrl(rawUrl?: string | null): boolean {
  return validateDriveOrHttpsUrl(rawUrl, { allowEmpty: true, allowRelative: true }).valid;
}
