import QRCode from 'qrcode';
import { EventCertificate } from '../config/rbacAndData';

export interface CertificateRenderOptions {
  certificate: EventCertificate;
  verificationUrl: string;
  leadName?: string;
}

function drawQrCodeOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number
): void {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    if (!count) return;

    const quietModules = 2;
    const totalModules = count + quietModules * 2;
    const cellSize = size / totalModules;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = '#070B10';
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.modules.get(row, col)) {
          const px = x + (col + quietModules) * cellSize;
          const py = y + (row + quietModules) * cellSize;
          ctx.fillRect(px, py, Math.ceil(cellSize), Math.ceil(cellSize));
        }
      }
    }
  } catch {
    // Non-blocking fallback if QR generation fails
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2
): number {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  let y = startY;
  for (const line of lines) {
    ctx.fillText(line, centerX, y);
    y += lineHeight;
  }
  return y;
}

/**
 * Renders a high-resolution 1600x1130 HTML5 Canvas E-Certificate (100% client-side,
 * zero external paid APIs) with an embedded scannable QR verification code and returns a PNG data URL.
 */
export function renderCertificateToDataUrl({
  certificate,
  verificationUrl,
  leadName = 'Campus Lead',
}: CertificateRenderOptions): string {
  const width = 1600;
  const height = 1130;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Deep Obsidian Engineering Background
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, '#070B10');
  bgGradient.addColorStop(0.5, '#0D141D');
  bgGradient.addColorStop(1, '#091017');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // Subtle ambient green corner glows
  const topGlow = ctx.createRadialGradient(260, 180, 10, 260, 180, 480);
  topGlow.addColorStop(0, 'rgba(0, 234, 100, 0.14)');
  topGlow.addColorStop(1, 'rgba(0, 234, 100, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, height);

  const bottomGlow = ctx.createRadialGradient(width - 240, height - 180, 10, width - 240, height - 180, 520);
  bottomGlow.addColorStop(0, 'rgba(0, 234, 100, 0.11)');
  bottomGlow.addColorStop(1, 'rgba(0, 234, 100, 0)');
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, 0, width, height);

  // Subtle engineering dot matrix along top & bottom margins
  ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
  for (let x = 84; x <= width - 84; x += 28) {
    for (let y = 84; y <= height - 84; y += 28) {
      if (x < 180 || x > width - 180 || y < 160 || y > height - 160) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  // 2. Precision Double Frame
  drawRoundedRect(ctx, 42, 42, width - 84, height - 84, 22);
  ctx.strokeStyle = 'rgba(0, 234, 100, 0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();

  drawRoundedRect(ctx, 58, 58, width - 116, height - 116, 16);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Corner green accents
  ctx.strokeStyle = '#00EA64';
  ctx.lineWidth = 4;
  const cornerLen = 48;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(42, 42 + cornerLen);
  ctx.lineTo(42, 42);
  ctx.lineTo(42 + cornerLen, 42);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(width - 42 - cornerLen, 42);
  ctx.lineTo(width - 42, 42);
  ctx.lineTo(width - 42, 42 + cornerLen);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(42, height - 42 - cornerLen);
  ctx.lineTo(42, height - 42);
  ctx.lineTo(42 + cornerLen, height - 42);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(width - 42 - cornerLen, height - 42);
  ctx.lineTo(width - 42, height - 42);
  ctx.lineTo(width - 42, height - 42 - cornerLen);
  ctx.stroke();

  // 3. Top Branding Header
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Brand emblem box
  drawRoundedRect(ctx, width / 2 - 220, 104, 440, 44, 8);
  ctx.fillStyle = 'rgba(0, 234, 100, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 234, 100, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#00EA64';
  ctx.font = '700 18px "JetBrains Mono", "Fira Code", monospace';
  ctx.fillText('HACKERRANK CAMPUS CREW · PAAVAI', width / 2, 126);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 18px "Inter", system-ui, sans-serif';
  ctx.fillText('PAAVAI ENGINEERING COLLEGE (AUTONOMOUS) · NAMAKKAL', width / 2, 178);

  // 4. Certificate Heading
  const headingLabel =
    certificate.awardType === 'Participation'
      ? 'CERTIFICATE OF PARTICIPATION'
      : certificate.awardType === 'Crew Recognition'
      ? 'CERTIFICATE OF APPRECIATION'
      : 'CERTIFICATE OF ACHIEVEMENT';

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 54px "Inter", system-ui, sans-serif';
  ctx.fillText(headingLabel, width / 2, 266);

  // Divider accent bar
  const barGradient = ctx.createLinearGradient(width / 2 - 180, 0, width / 2 + 180, 0);
  barGradient.addColorStop(0, 'rgba(0, 234, 100, 0)');
  barGradient.addColorStop(0.5, '#00EA64');
  barGradient.addColorStop(1, 'rgba(0, 234, 100, 0)');
  ctx.fillStyle = barGradient;
  ctx.fillRect(width / 2 - 180, 314, 360, 3);

  // 5. Recipient Presentation
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 22px "Inter", system-ui, sans-serif';
  ctx.fillText('THIS IS PROUDLY PRESENTED TO', width / 2, 376);

  // Recipient Name (dynamically sized for long names)
  const recipientName = certificate.recipientName.trim() || 'Student Member';
  let nameFontSize = 62;
  ctx.font = `800 ${nameFontSize}px "Inter", system-ui, sans-serif`;
  while (ctx.measureText(recipientName).width > 1220 && nameFontSize > 36) {
    nameFontSize -= 2;
    ctx.font = `800 ${nameFontSize}px "Inter", system-ui, sans-serif`;
  }
  ctx.fillStyle = '#00EA64';
  ctx.fillText(recipientName, width / 2, 456);

  // Subtle line under recipient name
  ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.fillRect(width / 2 - 320, 502, 640, 1.5);

  // Academic details line
  const academicParts = [
    certificate.registerNumber ? `Reg. No: ${certificate.registerNumber}` : '',
    certificate.department ? `Dept: ${certificate.department}` : '',
  ].filter(Boolean);

  if (academicParts.length > 0) {
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '600 20px "JetBrains Mono", "Fira Code", monospace';
    ctx.fillText(academicParts.join('   ·   '), width / 2, 536);
  }

  // 6. Award & Event Narrative
  const awardText =
    certificate.awardTitle && certificate.awardTitle.trim().length > 0
      ? certificate.awardTitle.trim()
      : certificate.awardType === 'Participation'
      ? 'for active participation and verified attendance in'
      : `for earning ${certificate.awardType} honours in`;

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '400 24px "Inter", system-ui, sans-serif';
  ctx.fillText(awardText, width / 2, 608);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 36px "Inter", system-ui, sans-serif';
  const afterEventY = wrapCenteredText(
    ctx,
    certificate.eventTitle,
    width / 2,
    668,
    1220,
    46,
    2
  );

  // Award Type badge
  const badgeText = certificate.awardType.toUpperCase();
  ctx.font = '700 16px "JetBrains Mono", "Fira Code", monospace';
  const badgeWidth = Math.max(190, ctx.measureText(badgeText).width + 48);
  const badgeY = Math.min(760, afterEventY + 18);
  drawRoundedRect(ctx, width / 2 - badgeWidth / 2, badgeY - 18, badgeWidth, 36, 6);
  ctx.fillStyle =
    certificate.awardType === 'Winner'
      ? 'rgba(245, 158, 11, 0.16)'
      : 'rgba(0, 234, 100, 0.14)';
  ctx.fill();
  ctx.strokeStyle =
    certificate.awardType === 'Winner'
      ? 'rgba(245, 158, 11, 0.55)'
      : 'rgba(0, 234, 100, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = certificate.awardType === 'Winner' ? '#FBBF24' : '#00EA64';
  ctx.fillText(badgeText, width / 2, badgeY);

  // Event Date & Issued Date
  const formattedEventDate = (() => {
    const parsed = new Date(certificate.eventDate);
    if (Number.isNaN(parsed.getTime())) return certificate.eventDate;
    return parsed.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  })();

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 19px "Inter", system-ui, sans-serif';
  ctx.fillText(
    `Conducted on ${formattedEventDate} · Paavai Engineering College Chapter`,
    width / 2,
    badgeY + 52
  );

  // 7. Signature, Seal, Credential Metadata & Embedded Verification QR Footer Row
  const footerLineY = 932;

  // Left: Issued By / Campus Lead Signature Block
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'italic 600 28px Georgia, serif';
  ctx.fillText(certificate.issuedByName || leadName, 300, footerLineY - 26);

  ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.fillRect(145, footerLineY, 310, 1.5);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 14px "JetBrains Mono", "Fira Code", monospace';
  ctx.fillText('AUTHORIZED CHAPTER SIGNATORY', 300, footerLineY + 26);
  ctx.fillStyle = '#64748B';
  ctx.font = '500 13px "Inter", system-ui, sans-serif';
  ctx.fillText('HackerRank Campus Crew · Paavai', 300, footerLineY + 50);

  // Center-Left: Verified Seal Emblem
  const sealCenterX = 680;
  ctx.beginPath();
  ctx.arc(sealCenterX, footerLineY + 4, 50, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 234, 100, 0.1)';
  ctx.fill();
  ctx.strokeStyle = '#00EA64';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(sealCenterX, footerLineY + 4, 40, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 234, 100, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#00EA64';
  ctx.font = '800 14px "JetBrains Mono", "Fira Code", monospace';
  ctx.fillText('VERIFIED', sealCenterX, footerLineY - 4);
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '600 11px "JetBrains Mono", "Fira Code", monospace';
  ctx.fillText('HRCC PEC', sealCenterX, footerLineY + 16);

  // Center-Right: Verification Metadata
  const issuedDateStr = (() => {
    const parsed = new Date(certificate.issuedAt);
    if (Number.isNaN(parsed.getTime())) return certificate.issuedAt;
    return parsed.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  })();

  const metaCenterX = 1040;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 16px "JetBrains Mono", "Fira Code", monospace';
  ctx.fillText(certificate.certId, metaCenterX, footerLineY - 26);

  ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.fillRect(metaCenterX - 150, footerLineY, 300, 1.5);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 14px "JetBrains Mono", "Fira Code", monospace';
  ctx.fillText(`ISSUED ${issuedDateStr.toUpperCase()}`, metaCenterX, footerLineY + 26);
  ctx.fillStyle = '#64748B';
  ctx.font = '500 12px "JetBrains Mono", "Fira Code", monospace';
  ctx.fillText('ONLINE VERIFICATION ENABLED', metaCenterX, footerLineY + 50);

  // Far-Right: Embedded Scannable QR Verification Card
  const qrCardX = 1326;
  const qrCardY = 840;
  const qrCardW = 166;
  const qrCardH = 166;

  drawRoundedRect(ctx, qrCardX, qrCardY, qrCardW, qrCardH, 12);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 234, 100, 0.75)';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawQrCodeOnCanvas(ctx, verificationUrl, qrCardX + 20, qrCardY + 12, 126);

  ctx.fillStyle = '#070B10';
  ctx.font = '800 11px "JetBrains Mono", "Fira Code", monospace';
  ctx.fillText('SCAN TO VERIFY', qrCardX + qrCardW / 2, qrCardY + qrCardH - 14);

  // Bottom verification URL bar
  ctx.fillStyle = '#64748B';
  ctx.font = '500 14px "JetBrains Mono", "Fira Code", monospace';
  ctx.fillText(`Verify authenticity at: ${verificationUrl}`, width / 2, height - 80);

  return canvas.toDataURL('image/png');
}

export function downloadCertificatePng(options: CertificateRenderOptions): void {
  const dataUrl = renderCertificateToDataUrl(options);
  if (!dataUrl) return;
  const safeName = options.certificate.recipientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `HRCC-Paavai-${options.certificate.certId}-${safeName || 'certificate'}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function buildLinkedInAddCertUrl(
  certificate: EventCertificate,
  verificationUrl: string
): string {
  const issued = new Date(certificate.issuedAt);
  const year = Number.isNaN(issued.getTime()) ? new Date().getFullYear() : issued.getFullYear();
  const month = Number.isNaN(issued.getTime()) ? new Date().getMonth() + 1 : issued.getMonth() + 1;
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: `${certificate.awardType} — ${certificate.eventTitle}`,
    organizationName: 'HackerRank Campus Crew - Paavai Engineering College',
    issueYear: String(year),
    issueMonth: String(month),
    certId: certificate.certId,
    certUrl: verificationUrl,
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}
