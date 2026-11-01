import { jsPDF } from 'jspdf';

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
  signatoryTitle = 'Chief Executive Officer',
  issueDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 2400;
  canvas.height = 1700;
  const ctx = canvas.getContext('2d');

  // 1. Parchment Background
  const bgGrad = ctx.createRadialGradient(1200, 850, 200, 1200, 850, 1400);
  bgGrad.addColorStop(0, '#FFFFFF');
  bgGrad.addColorStop(0.5, '#FDFBF7');
  bgGrad.addColorStop(1, '#F7F2E7');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Guilloche / Fine Security Geometric Border
  ctx.save();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 40; i <= 90; i += 10) {
    ctx.strokeRect(i, i, canvas.width - i * 2, canvas.height - i * 2);
  }
  ctx.restore();

  // 3. Luxury Gold Outer Border Frame
  ctx.save();
  const goldGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  goldGrad.addColorStop(0, '#AA771C');
  goldGrad.addColorStop(0.25, '#FFDF00');
  goldGrad.addColorStop(0.5, '#D4AF37');
  goldGrad.addColorStop(0.75, '#FEE180');
  goldGrad.addColorStop(1, '#8A5A00');

  ctx.lineWidth = 14;
  ctx.strokeStyle = goldGrad;
  ctx.strokeRect(90, 90, canvas.width - 180, canvas.height - 180);

  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1E293B';
  ctx.strokeRect(114, 114, canvas.width - 228, canvas.height - 228);

  ctx.lineWidth = 2;
  ctx.strokeStyle = goldGrad;
  ctx.strokeRect(126, 126, canvas.width - 252, canvas.height - 252);
  ctx.restore();

  // 4. Corner Ornaments
  const corners = [
    [130, 130],
    [canvas.width - 130, 130],
    [130, canvas.height - 130],
    [canvas.width - 130, canvas.height - 130],
  ];
  corners.forEach(([cx, cy]) => {
    ctx.save();
    ctx.strokeStyle = '#D4AF37';
    ctx.fillStyle = '#D4AF37';
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  // 5. Header Organization Title
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 36px "Cinzel", "Georgia", "Times New Roman", serif';
  ctx.fillStyle = '#64748B';
  ctx.letterSpacing = '6px';
  ctx.fillText(companyName.toUpperCase(), 1200, 220);
  ctx.restore();

  // 6. Main Certificate Title
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '800 64px "Cinzel", "Georgia", "Times New Roman", serif';
  ctx.fillStyle = '#0F172A';
  ctx.letterSpacing = '8px';
  ctx.fillText('CERTIFICATE OF RECOGNITION', 1200, 310);
  ctx.restore();

  // Gold Divider Ribbon
  ctx.save();
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(850, 345);
  ctx.lineTo(1550, 345);
  ctx.stroke();

  ctx.fillStyle = '#D4AF37';
  ctx.beginPath();
  ctx.arc(1200, 345, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 7. Presentation Subtitle
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '400 26px "Georgia", serif';
  ctx.fillStyle = '#64748B';
  ctx.letterSpacing = '3px';
  ctx.fillText('THIS PRESTIGIOUS HONOR IS OFFICIALLY PRESENTED TO', 1200, 420);
  ctx.restore();

  // 8. Recipient Name
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 74px "Playfair Display", "Georgia", serif';
  ctx.fillStyle = '#1E1B4B';
  ctx.fillText(employeeName || 'Honored Employee', 1200, 520);
  ctx.restore();

  // Employee ID Tag
  if (employeeId) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '600 22px "Inter", "Arial", sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.letterSpacing = '2px';
    ctx.fillText(`EMPLOYEE ID: ${employeeId.toUpperCase()}`, 1200, 565);
    ctx.restore();
  }

  // 9. Award Badge Box / Ribbon
  ctx.save();
  const ribbonY = 620;
  const ribbonW = 780;
  const ribbonH = 76;
  const ribbonX = 1200 - ribbonW / 2;

  const ribbonGrad = ctx.createLinearGradient(ribbonX, 0, ribbonX + ribbonW, 0);
  ribbonGrad.addColorStop(0, '#1E1B4B');
  ribbonGrad.addColorStop(0.5, '#312E81');
  ribbonGrad.addColorStop(1, '#1E1B4B');

  ctx.fillStyle = ribbonGrad;
  ctx.beginPath();
  ctx.roundRect(ribbonX, ribbonY, ribbonW, ribbonH, 12);
  ctx.fill();

  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FEE180';
  ctx.font = 'bold 36px "Cinzel", "Georgia", serif';
  ctx.letterSpacing = '4px';
  ctx.fillText((awardTitle || 'EMPLOYEE OF THE MONTH').toUpperCase(), 1200, ribbonY + 52);
  ctx.restore();

  // 10. Employee Photo (Optional circular portrait)
  let citationY = 760;
  if (employeePhoto) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => resolve(null);
        img.src = employeePhoto;
      });

      if (img.width > 0) {
        ctx.save();
        const photoSize = 130;
        const photoX = 1200 - photoSize / 2;
        const photoY = 740;

        ctx.beginPath();
        ctx.arc(1200, photoY + photoSize / 2, photoSize / 2 + 6, 0, Math.PI * 2);
        ctx.fillStyle = '#D4AF37';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(1200, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, photoX, photoY, photoSize, photoSize);
        ctx.restore();
        citationY = 910;
      }
    } catch {
      citationY = 760;
    }
  }

  // 11. Citation / Custom Feedback
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'italic 28px "Georgia", serif';
  ctx.fillStyle = '#334155';

  const commentText = customComment && customComment.trim()
    ? `“${customComment.trim()}”`
    : '“In recognition of distinguished dedication, technical excellence, and outstanding contributions to organizational milestones.”';

  // Word wrap for citation
  const maxWidth = 1300;
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

  // 12. Period / Conferment
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '600 24px "Inter", "Arial", sans-serif';
  ctx.fillStyle = '#4F46E5';
  ctx.letterSpacing = '1px';
  ctx.fillText(`Conferred for ${period}`, 1200, citationY + (lines.length * 40) + 30);
  ctx.restore();

  // 13. Official Golden Seal (Center-Bottom)
  ctx.save();
  const sealX = 1200;
  const sealY = 1340;
  const sealRadius = 65;

  const sealGrad = ctx.createRadialGradient(sealX, sealY, 10, sealX, sealY, sealRadius);
  sealGrad.addColorStop(0, '#FFF275');
  sealGrad.addColorStop(0.4, '#D4AF37');
  sealGrad.addColorStop(1, '#8A5A00');

  ctx.fillStyle = sealGrad;
  ctx.beginPath();
  ctx.arc(sealX, sealY, sealRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px "Cinzel", "Arial", sans-serif';
  ctx.fillText('OFFICIAL', sealX, sealY - 8);
  ctx.fillText('SEAL', sealX, sealY + 12);
  ctx.font = '12px "Arial", sans-serif';
  ctx.fillText('★ ★ ★', sealX, sealY + 30);
  ctx.restore();

  // 14. Signatures
  // Left: Date of Issue
  ctx.save();
  ctx.textAlign = 'center';
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(400, 1420);
  ctx.lineTo(750, 1420);
  ctx.stroke();

  ctx.font = '500 24px "Georgia", serif';
  ctx.fillStyle = '#1E293B';
  ctx.fillText(issueDate, 575, 1400);

  ctx.font = '600 18px "Inter", sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText('DATE OF CONFERMENT', 575, 1450);
  ctx.restore();

  // Right: Authorized Signatory
  ctx.save();
  ctx.textAlign = 'center';
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(1650, 1420);
  ctx.lineTo(2000, 1420);
  ctx.stroke();

  // Signature cursive flourish
  ctx.font = 'italic bold 32px "Playfair Display", "Georgia", serif';
  ctx.fillStyle = '#312E81';
  ctx.fillText('Elena Rostova', 1825, 1400);

  ctx.font = '600 18px "Inter", sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText(signatoryTitle.toUpperCase(), 1825, 1450);
  ctx.restore();

  return canvas;
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
