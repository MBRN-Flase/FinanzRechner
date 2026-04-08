import { SCENARIOS } from '../core/scenarios.js';
import { buildInsight } from '../core/insight.js';
import {
  formatCurrency,
  formatCurrencyShort,
  roundRect,
  wrapText,
} from '../core/formatters.js';

export function exportScreenshot({ showToast, generateShareImage }) {
  const resultSection = document.getElementById('result-section');
  if (!resultSection || resultSection.style.display === 'none') {
    showToast('Bitte zuerst berechnen');
    return;
  }

  const captureElement = document.createElement('div');
  captureElement.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;background:#030014;padding:40px;border-radius:20px;';

  const hero = document.querySelector('.result-hero')?.cloneNode(true);
  const compare = document.querySelector('.compare-grid')?.cloneNode(true);
  const details = document.querySelector('.details-grid')?.cloneNode(true);
  if (hero) captureElement.appendChild(hero);
  if (compare) captureElement.appendChild(compare);
  if (details) captureElement.appendChild(details);
  document.body.appendChild(captureElement);

  if (typeof html2canvas !== 'undefined') {
    html2canvas(captureElement, {
      backgroundColor: '#030014',
      scale: 2,
      logging: false,
    }).then((canvas) => {
      const link = document.createElement('a');
      link.download = 'MBRN-Finanz-Ergebnis.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      document.body.removeChild(captureElement);
    }).catch(() => {
      showToast('Screenshot konnte nicht erstellt werden');
      document.body.removeChild(captureElement);
    });
  } else {
    generateShareImage('post');
    document.body.removeChild(captureElement);
  }
}

export function buildShareText(result, activeScenario) {
  const url = window.location.href.split('?')[0];
  return [
    'Was waerst du heute wert, wenn du frueher investiert haettest?',
    `Ich hab es durchgerechnet: ${SCENARIOS[activeScenario].name} ueber ${result.years} Jahre -> ${formatCurrency(result.realValue)}`,
    `Statt ${formatCurrencyShort(result.fiatVal)} auf dem Konto. Unterschied: ${formatCurrency(result.realValue - result.fiatVal)}`,
    `=> ${url}`,
    '#Investieren #FinanzielleFreiheit #MBRN #Vermoegensaufbau',
  ].join('\n');
}

export function generateShareImage(result, activeScenario, format = 'post') {
  const isStory = format === 'story';
  const width = 1080;
  const height = isStory ? 1920 : 1080;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#030014';
  ctx.fillRect(0, 0, width, height);
  const radial = ctx.createRadialGradient(width, 0, 0, width, 0, 600);
  radial.addColorStop(0, 'rgba(157,80,187,.35)');
  radial.addColorStop(1, 'transparent');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#b388ff';
  ctx.fillRect(0, 0, width, 6);
  ctx.fillRect(0, height - 6, width, 6);

  if (isStory) drawStoryCard(ctx, result, activeScenario, width, height);
  else drawPostCard(ctx, result, activeScenario, width, height);

  const link = document.createElement('a');
  link.download = isStory ? 'mbrn-finanz-story.png' : 'mbrn-finanz-post.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function drawPostCard(ctx, result, activeScenario, width, height) {
  const centerX = width / 2;
  ctx.fillStyle = 'rgba(179,136,255,.55)';
  ctx.font = '500 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('WAS WAERST DU HEUTE WERT? - MBRN', centerX, 68);

  let fontSize = 180;
  const valueText = formatCurrency(result.realValue);
  ctx.font = `bold ${fontSize}px sans-serif`;
  while (ctx.measureText(valueText).width > width * 0.82 && fontSize > 60) {
    fontSize -= 8;
    ctx.font = `bold ${fontSize}px sans-serif`;
  }

  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(179,136,255,.3)';
  ctx.shadowBlur = 40;
  const gradient = ctx.createLinearGradient(200, 0, width - 200, 0);
  gradient.addColorStop(0, '#fff');
  gradient.addColorStop(1, '#b388ff');
  ctx.fillStyle = gradient;
  ctx.fillText(valueText, centerX, 330);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(234,234,244,.4)';
  ctx.font = '400 26px monospace';
  ctx.fillText(`heutige Kaufkraft nach ${result.years} Jahren`, centerX, 430);

  const boxWidth = 420;
  const boxHeight = 130;
  const gap = 36;
  const y = 480;
  drawBox(ctx, 'rgba(255,107,107,.1)', 'rgba(255,107,107,.35)', centerX - boxWidth - gap / 2, y, boxWidth, boxHeight, 'FIAT - INFLATION', '#ff6b6b', formatCurrencyShort(result.fiatVal), 36);
  drawBox(ctx, 'rgba(79,255,176,.1)', 'rgba(79,255,176,.35)', centerX + gap / 2, y, boxWidth, boxHeight, SCENARIOS[activeScenario].name.toUpperCase(), '#4fffb0', formatCurrencyShort(result.realValue), 36);

  drawStats(ctx, result, width, 656);
  drawInsightBox(ctx, result, activeScenario, width, 760, 116);

  ctx.fillStyle = 'rgba(179,136,255,.4)';
  ctx.font = '400 18px monospace';
  ctx.fillText('flase-mbrn.github.io/FinanzRechner', centerX, height - 22);
}

function drawStoryCard(ctx, result, activeScenario, width, height) {
  const centerX = width / 2;
  ctx.fillStyle = 'rgba(179,136,255,.6)';
  ctx.font = '500 26px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MBRN - FINANZ-RECHNER', centerX, 100);

  ctx.fillStyle = 'rgba(234,234,244,.85)';
  ctx.font = 'bold 50px sans-serif';
  ctx.fillText('Was waerst du heute', centerX, 200);
  ctx.fillText('wert?', centerX, 265);

  let fontSize = 140;
  const valueText = formatCurrency(result.realValue);
  ctx.font = `bold ${fontSize}px sans-serif`;
  while (ctx.measureText(valueText).width > width * 0.85 && fontSize > 60) {
    fontSize -= 8;
    ctx.font = `bold ${fontSize}px sans-serif`;
  }

  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(179,136,255,.4)';
  ctx.shadowBlur = 50;
  const gradient = ctx.createLinearGradient(100, 0, width - 100, 0);
  gradient.addColorStop(0, '#fff');
  gradient.addColorStop(1, '#b388ff');
  ctx.fillStyle = gradient;
  ctx.fillText(valueText, centerX, 430);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(234,234,244,.5)';
  ctx.font = '400 28px monospace';
  ctx.fillText(`bei ${result.years} Jahren ${SCENARIOS[activeScenario].name}`, centerX, 530);

  const boxWidth = 380;
  const boxHeight = 155;
  const gap = 36;
  const y = 598;
  drawBox(ctx, 'rgba(255,107,107,.1)', 'rgba(255,107,107,.35)', centerX - boxWidth - gap / 2, y, boxWidth, boxHeight, 'FIAT - INFLATION', '#ff6b6b', formatCurrencyShort(result.fiatVal), 42);
  drawBox(ctx, 'rgba(79,255,176,.1)', 'rgba(79,255,176,.35)', centerX + gap / 2, y, boxWidth, boxHeight, SCENARIOS[activeScenario].name.toUpperCase(), '#4fffb0', formatCurrencyShort(result.realValue), 42);

  drawStats(ctx, result, width, 822);
  drawInsightBox(ctx, result, activeScenario, width, 1310, 200);
}

function drawBox(ctx, fill, stroke, x, y, w, h, label, valueColor, valueText, fontSize) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 12, true, true);
  ctx.fillStyle = 'rgba(234,234,244,.35)';
  ctx.font = '400 17px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, x + w / 2, y + 30);
  ctx.fillStyle = valueColor;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(valueText, x + w / 2, y + h * 0.65);
}

function drawStats(ctx, result, width, y) {
  const stats = [
    { label: 'JAHRE', value: result.years },
    { label: 'EINGEZAHLT', value: formatCurrencyShort(result.totalInvested) },
    { label: 'GEWINN', value: formatCurrencyShort(Math.max(0, result.realGain)) },
    { label: 'FAKTOR', value: `${result.realFactor.toFixed(1)}x` },
  ];
  const segmentWidth = (width - 120) / 4;

  stats.forEach((stat, index) => {
    const x = 60 + index * segmentWidth;
    ctx.fillStyle = 'rgba(234,234,244,.25)';
    ctx.font = '400 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(stat.label, x + segmentWidth / 2, y + 22);
    ctx.fillStyle = '#b388ff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(stat.value, x + segmentWidth / 2, y + 62);
  });
}

function drawInsightBox(ctx, result, activeScenario, width, y, boxHeight) {
  ctx.fillStyle = 'rgba(179,136,255,.1)';
  ctx.strokeStyle = 'rgba(179,136,255,.2)';
  ctx.lineWidth = 1;
  roundRect(ctx, 60, y, width - 120, boxHeight, 12, true, true);
  ctx.fillStyle = 'rgba(234,234,244,.5)';
  ctx.font = '400 19px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let insight = buildInsight(result, activeScenario);
  if (insight.length > 170) insight = `${insight.substring(0, 167)}...`;
  wrapText(ctx, insight, width / 2, y + boxHeight / 2 - 16, width - 160, 32);
}
