/* sw.js — MBRN FinanzRechner v2.0 (Unified Template) */
'use strict';

importScripts('../shared/core/sw-template.js');

MBRNServiceWorker.init({
  toolName: 'finanzrechner',
  version: '2.0.0',
  appShell: [
    '/FinanzRechner/',
    '/FinanzRechner/index.html',
    '/FinanzRechner/style.css',
    '/FinanzRechner/manifest.json',
    '/FinanzRechner/impressum.html',
    '/FinanzRechner/datenschutz.html',
    '/FinanzRechner/src/main.js',
    '/FinanzRechner/src/core/calculator.js',
    '/FinanzRechner/src/core/formatters.js',
    '/FinanzRechner/src/core/insight.js',
    '/FinanzRechner/src/core/scenarios.js',
    '/FinanzRechner/src/modules/prices.js',
    '/FinanzRechner/src/modules/share.js',
    '/FinanzRechner/src/ui/chart.js',
    '/FinanzRechner/src/ui/render.js',
    '/shared/core/storage.mjs',
    '/shared/core/backend.mjs',
    '/shared/core/theme.mjs',
    '/shared/navigation.js'
  ],
  fontHosts: ['fonts.googleapis.com', 'fonts.gstatic.com'],
  apiHosts: ['api.coingecko.com'],
  cdnHosts: ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com']
});
