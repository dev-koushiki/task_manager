import { jsPDF } from 'jspdf';

export const CERTIFICATE_TEMPLATES = {
  'classic-gold': {
    id: 'classic-gold',
    name: 'Executive Gold',
    badge: 'Official Classic',
    bgColors: ['#FFFFFF', '#FDFBF7', '#F7F2E7'],
    borderOuter: ['#AA771C', '#FFDF00', '#D4AF37', '#FEE180', '#8A5A00'],
    borderInner: '#1E293B',
    accentColor: '#D4AF37',
    companyTitleColor: '#64748B',
    mainTitleColor: '#0F172A',
    recipientColor: '#1E1B4B',
    badgeGrad: ['#1E1B4B', '#312E81', '#1E1B4B'],
    badgeTextColor: '#FEE180',
    citationColor: '#334155',
    periodColor: '#4F46E5',
    sealGrad: ['#FFF275', '#D4AF37', '#8A5A00'],
    sealTextColor: '#FFFFFF',
    signatureColor: '#312E81',
    lineColor: '#94A3B8',
  },
  'modern-navy': {
    id: 'modern-navy',
    name: 'Modern Navy Cyan',
    badge: 'Tech & Modern',
    bgColors: ['#0B1120', '#0F172A', '#030712'],
    borderOuter: ['#0284C7', '#38BDF8', '#6366F1', '#38BDF8', '#0369A1'],
    borderInner: '#1E293B',
    accentColor: '#38BDF8',
    companyTitleColor: '#94A3B8',
    mainTitleColor: '#F8FAFC',
    recipientColor: '#38BDF8',
    badgeGrad: ['#0284C7', '#2563EB', '#1D4ED8'],
    badgeTextColor: '#FFFFFF',
    citationColor: '#CBD5E1',
    periodColor: '#38BDF8',
    sealGrad: ['#E0F2FE', '#38BDF8', '#0284C7'],
    sealTextColor: '#0F172A',
    signatureColor: '#38BDF8',
    lineColor: '#475569',
  },
  'emerald-elite': {
    id: 'emerald-elite',
    name: 'Emerald Leadership',
    badge: 'Leadership Elite',
    bgColors: ['#FAFCFA', '#F0FDF4', '#DCFCE7'],
    borderOuter: ['#065F46', '#059669', '#D4AF37', '#10B981', '#064E3B'],
    borderInner: '#064E3B',
    accentColor: '#059669',
    companyTitleColor: '#047857',
    mainTitleColor: '#064E3B',
    recipientColor: '#064E3B',
    badgeGrad: ['#064E3B', '#065F46', '#047857'],
    badgeTextColor: '#FEF08A',
    citationColor: '#1E293B',
    periodColor: '#059669',
    sealGrad: ['#FEF08A', '#10B981', '#065F46'],
    sealTextColor: '#FFFFFF',
    signatureColor: '#064E3B',
    lineColor: '#6EE7B7',
  },
  'royal-crimson': {
    id: 'royal-crimson',
    name: 'Royal Crimson & Gold',
    badge: 'Prestige & Honors',
    bgColors: ['#FFFDFB', '#FAF5EE', '#F5EBE0'],
    borderOuter: ['#881337', '#BE123C', '#F59E0B', '#E11D48', '#4C0519'],
    borderInner: '#4C0519',
    accentColor: '#BE123C',
    companyTitleColor: '#9F1239',
    mainTitleColor: '#4C0519',
    recipientColor: '#881337',
    badgeGrad: ['#881337', '#9F1239', '#881337'],
    badgeTextColor: '#FFF1F2',
    citationColor: '#334155',
    periodColor: '#BE123C',
    sealGrad: ['#FFE4E6', '#F43F5E', '#881337'],
    sealTextColor: '#FFFFFF',
    signatureColor: '#881337',
    lineColor: '#FDA4AF',
  },
};

/**
 * Generates an official high-resolution landscape certificate on an HTML5 Canvas.
 * Resolution: 2400 x 1700 pixels (printable 300 DPI equivalent)
 */
export async function generateCertificateCanvas({
  employeeName,
  employeeId,
  employeePhoto,
  awardTitle,
  period,
  customComment,
  companyName = 'TaskFlow Enterprise',
  signatoryName = 'Elena Rostova',
  signatoryTitle = 'Chief Executive Officer',
  issueDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  templateId = 'classic-gold',
  customTemplateImage = '',
  companyLogo = '',
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 2400;
  canvas.height = 1700;
  const ctx = canvas.getContext('2d');

  const isCustomBg = templateId === 'custom' && customTemplateImage;
  const theme = CERTIFICATE_TEMPLATES[templateId] || CERTIFICATE_TEMPLATES['classic-gold'];

  // 1. Background (Custom Template Image OR Radial Gradient)
  if (isCustomBg) {
    try {
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        bgImg.onload = resolve;
        bgImg.onerror = () => resolve(null);
        bgImg.src = customTemplateImage;
      });
      if (bgImg.width > 0) {
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
      } else {
        throw new Error('Could not load custom background');
      }
    } catch {
      paintDefaultThemeBackground(ctx, canvas, theme);
    }
  } else {
    paintDefaultThemeBackground(ctx, canvas, theme);
  }

  // 2. Borders & Corner Ornaments (skip heavy border if custom full-bleed template)
  if (!isCustomBg) {
    // Guilloche / Security Pattern
    ctx.save();
    ctx.strokeStyle = templateId === 'modern-navy' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(212, 175, 55, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 40; i <= 90; i += 10) {
      ctx.strokeRect(i, i, canvas.width - i * 2, canvas.height - i * 2);
    }
    ctx.restore();

    // Outer Gradient Border Frame
    ctx.save();
    const borderGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    const borderColors = theme.borderOuter;
    borderColors.forEach((color, idx) => {
      borderGrad.addColorStop(idx / (borderColors.length - 1), color);
    });

    ctx.lineWidth = 14;
    ctx.strokeStyle = borderGrad;
    ctx.strokeRect(90, 90, canvas.width - 180, canvas.height - 180);

    ctx.lineWidth = 4;
    ctx.strokeStyle = theme.borderInner;
    ctx.strokeRect(114, 114, canvas.width - 228, canvas.height - 228);

    ctx.lineWidth = 2;
    ctx.strokeStyle = borderGrad;
    ctx.strokeRect(126, 126, canvas.width - 252, canvas.height - 252);
    ctx.restore();

    // Corner Ornaments
    const corners = [
      [130, 130],
      [canvas.width - 130, 130],
      [130, canvas.height - 130],
      [canvas.width - 130, canvas.height - 130],
    ];
    corners.forEach(([cx, cy]) => {
      ctx.save();
      ctx.strokeStyle = theme.accentColor;
      ctx.fillStyle = theme.accentColor;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  // 3. Optional Company Logo
  let logoOffset = 0;
  if (companyLogo) {
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = () => resolve(null);
        logoImg.src = companyLogo;
      });
      if (logoImg.width > 0) {
        const targetH = 90;
        const targetW = (logoImg.width / logoImg.height) * targetH;
        ctx.drawImage(logoImg, 1200 - targetW / 2, 140, targetW, targetH);
        logoOffset = 30;
      }
    } catch (_) {}
  }

  // 4. Header Organization Title
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 36px "Cinzel", "Georgia", "Times New Roman", serif';
  ctx.fillStyle = theme.companyTitleColor;
  ctx.letterSpacing = '6px';
  ctx.fillText((companyName || 'TaskFlow Enterprise').toUpperCase(), 1200, 220 + logoOffset);
  ctx.restore();

  // 5. Main Certificate Title
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '800 64px "Cinzel", "Georgia", "Times New Roman", serif';
  ctx.fillStyle = theme.mainTitleColor;
  ctx.letterSpacing = '8px';
  ctx.fillText('CERTIFICATE OF RECOGNITION', 1200, 310 + logoOffset);
  ctx.restore();

  // Decorative Accent Divider Ribbon
  ctx.save();
  ctx.strokeStyle = theme.accentColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(850, 345 + logoOffset);
  ctx.lineTo(1550, 345 + logoOffset);
  ctx.stroke();

  ctx.fillStyle = theme.accentColor;
  ctx.beginPath();
  ctx.arc(1200, 345 + logoOffset, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 6. Presentation Subtitle
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '400 26px "Georgia", serif';
  ctx.fillStyle = theme.companyTitleColor;
  ctx.letterSpacing = '3px';
  ctx.fillText('THIS PRESTIGIOUS HONOR IS OFFICIALLY PRESENTED TO', 1200, 420 + logoOffset);
  ctx.restore();

  // 7. Recipient Name
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 74px "Playfair Display", "Georgia", serif';
  ctx.fillStyle = theme.recipientColor;
  ctx.fillText(employeeName || 'Honored Employee', 1200, 520 + logoOffset);
  ctx.restore();

  // Employee ID Tag
  if (employeeId) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '600 22px "Inter", "Arial", sans-serif';
    ctx.fillStyle = theme.companyTitleColor;
    ctx.letterSpacing = '2px';
    ctx.fillText(`EMPLOYEE ID: ${String(employeeId).toUpperCase()}`, 1200, 565 + logoOffset);
    ctx.restore();
  }

  // 8. Award Badge Box / Ribbon
  ctx.save();
  const ribbonY = 620 + logoOffset;
  const ribbonW = 780;
  const ribbonH = 76;
  const ribbonX = 1200 - ribbonW / 2;

  const ribbonGrad = ctx.createLinearGradient(ribbonX, 0, ribbonX + ribbonW, 0);
  ribbonGrad.addColorStop(0, theme.badgeGrad[0]);
  ribbonGrad.addColorStop(0.5, theme.badgeGrad[1]);
  ribbonGrad.addColorStop(1, theme.badgeGrad[2] || theme.badgeGrad[0]);

  ctx.fillStyle = ribbonGrad;
  ctx.beginPath();
  ctx.roundRect(ribbonX, ribbonY, ribbonW, ribbonH, 12);
  ctx.fill();

  ctx.strokeStyle = theme.accentColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = theme.badgeTextColor;
  ctx.font = 'bold 36px "Cinzel", "Georgia", serif';
  ctx.letterSpacing = '4px';
  ctx.fillText((awardTitle || 'EMPLOYEE OF THE MONTH').toUpperCase(), 1200, ribbonY + 52);
  ctx.restore();

  // 9. Employee Photo (Optional circular portrait)
  let citationY = 760 + logoOffset;
  if (employeePhoto) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = () => resolve(null);
        img.src = employeePhoto;
      });

      if (img.width > 0) {
        ctx.save();
        const photoSize = 130;
        const photoX = 1200 - photoSize / 2;
        const photoY = 740 + logoOffset;

        ctx.beginPath();
        ctx.arc(1200, photoY + photoSize / 2, photoSize / 2 + 6, 0, Math.PI * 2);
        ctx.fillStyle = theme.accentColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(1200, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, photoX, photoY, photoSize, photoSize);
        ctx.restore();
        citationY = 910 + logoOffset;
      }
    } catch {
      citationY = 760 + logoOffset;
    }
  }

  // 10. Citation / Custom Feedback
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'italic 28px "Georgia", serif';
  ctx.fillStyle = theme.citationColor;

  const commentText = customComment && customComment.trim()
    ? `“${customComment.trim()}”`
    : '“In recognition of distinguished dedication, technical excellence, and outstanding contributions to organizational milestones.”';

  const maxWidth = 1320;
  const words = commentText.split(' ');
  let line = '';
  const lines = [];

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(line);
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line);

  lines.forEach((l, idx) => {
    ctx.fillText(l.trim(), 1200, citationY + (idx * 40));
  });
  ctx.restore();

  // 11. Period / Conferment
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '600 24px "Inter", "Arial", sans-serif';
  ctx.fillStyle = theme.periodColor;
  ctx.letterSpacing = '1px';
  ctx.fillText(`Conferred for ${period}`, 1200, citationY + (lines.length * 40) + 30);
  ctx.restore();

  // 12. Official Golden Seal (Center-Bottom)
  ctx.save();
  const sealX = 1200;
  const sealY = 1350;
  const sealRadius = 66;

  const sealGrad = ctx.createRadialGradient(sealX, sealY, 10, sealX, sealY, sealRadius);
  sealGrad.addColorStop(0, theme.sealGrad[0]);
  sealGrad.addColorStop(0.4, theme.sealGrad[1]);
  sealGrad.addColorStop(1, theme.sealGrad[2]);

  ctx.fillStyle = sealGrad;
  ctx.beginPath();
  ctx.arc(sealX, sealY, sealRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = theme.sealTextColor;
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px "Cinzel", "Arial", sans-serif';
  ctx.fillText('OFFICIAL', sealX, sealY - 8);
  ctx.fillText('SEAL', sealX, sealY + 12);
  ctx.font = '12px "Arial", sans-serif';
  ctx.fillText('★ ★ ★', sealX, sealY + 30);
  ctx.restore();

  // 13. Signatures
  // Left: Date of Issue
  ctx.save();
  ctx.textAlign = 'center';
  ctx.strokeStyle = theme.lineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(400, 1430);
  ctx.lineTo(750, 1430);
  ctx.stroke();

  ctx.font = '500 24px "Georgia", serif';
  ctx.fillStyle = theme.citationColor;
  ctx.fillText(issueDate, 575, 1410);

  ctx.font = '600 18px "Inter", sans-serif';
  ctx.fillStyle = theme.companyTitleColor;
  ctx.fillText('DATE OF CONFERMENT', 575, 1460);
  ctx.restore();

  // Right: Authorized Signatory
  ctx.save();
  ctx.textAlign = 'center';
  ctx.strokeStyle = theme.lineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(1650, 1430);
  ctx.lineTo(2000, 1430);
  ctx.stroke();

  ctx.font = 'italic bold 32px "Playfair Display", "Georgia", serif';
  ctx.fillStyle = theme.signatureColor;
  ctx.fillText(signatoryName, 1825, 1410);

  ctx.font = '600 18px "Inter", sans-serif';
  ctx.fillStyle = theme.companyTitleColor;
  ctx.fillText((signatoryTitle || 'CHIEF EXECUTIVE OFFICER').toUpperCase(), 1825, 1460);
  ctx.restore();

  return canvas;
}

function paintDefaultThemeBackground(ctx, canvas, theme) {
  const bgGrad = ctx.createRadialGradient(1200, 850, 200, 1200, 850, 1400);
  bgGrad.addColorStop(0, theme.bgColors[0]);
  bgGrad.addColorStop(0.5, theme.bgColors[1]);
  bgGrad.addColorStop(1, theme.bgColors[2]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Downloads canvas as a high-resolution PNG image
 */
export function downloadCertificatePng(canvas, filename = 'certificate.png') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png', 1.0);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Downloads canvas as a JPEG image
 */
export function downloadCertificateJpeg(canvas, filename = 'certificate.jpg') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Downloads canvas as a crisp landscape PDF document
 */
export function downloadCertificatePdf(canvas, filename = 'certificate.pdf') {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [canvas.width, canvas.height],
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}

/**
 * Converts canvas to a downloadable Blob
 */
export function getCertificateBlob(canvas, mimeType = 'image/png') {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, 0.95);
  });
}
