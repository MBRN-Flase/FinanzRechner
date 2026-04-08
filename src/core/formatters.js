export function formatCurrency(v) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);
}

export function formatCurrencyShort(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1).replace('.', ',')} Mio. EUR`;
  if (v >= 1000) return `${Math.round(v / 1000)} TEUR`;
  return formatCurrency(v);
}

export function formatNum(n) {
  if (n >= 1000) return `${Math.round(n).toLocaleString('de-DE')} x`;
  if (n % 1 === 0) return `${n} x`;
  return `${n.toFixed(1)} x`;
}

export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let lineY = y;

  words.forEach((word) => {
    const candidate = `${line}${line ? ' ' : ''}${word}`;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = candidate;
    }
  });

  if (line) ctx.fillText(line, x, lineY);
}

export function roundRect(ctx, x, y, w, h, r, fill, stroke) {
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
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
