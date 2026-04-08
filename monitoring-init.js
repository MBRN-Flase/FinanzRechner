/**
 * FinanzRechner Monitoring Initialization
 * External script for CSP compliance
 */

(function() {
  'use strict';
  
  // 1. Logger first
  if (window.logger) {
    logger.setDebug(location.search.includes('debug'));
    logger.info('[FinanzRechner] Logger initialized');
  }

  // 2. Error handling
  if (window.MBRNError) {
    MBRNError.init({
      captureConsole: true,
      captureGlobal: true,
      reportToApi: true,
      apiEndpoint: 'https://mbrn-api.vercel.app/api/log-error',
      context: 'finanzrechner',
      version: '1.0.0'
    });
    logger.info('[FinanzRechner] Error handling initialized');
  }

  // 3. Analytics
  if (window.MBRNAnalytics) {
    MBRNAnalytics.init();
    logger.info('[FinanzRechner] Analytics initialized');
  }
})();
