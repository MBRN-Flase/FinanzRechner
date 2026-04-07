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
    '/FinanzRechner/app.js',
    '/FinanzRechner/manifest.json',
    '/FinanzRechner/impressum.html',
    '/FinanzRechner/datenschutz.html'
  ],
  fontHosts: ['fonts.googleapis.com', 'fonts.gstatic.com'],
  apiHosts: ['api.coingecko.com'],
  cdnHosts: ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com']
});
