/**
 * FinanzRechner Service Worker Registration
 * External file for CSP compliance
 */

(function() {
  'use strict';
  
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js')
        .then(function(registration) {
          if (typeof window.logger !== 'undefined') {
            window.logger.debug('[FinanzRechner] Service Worker registered');
          }
        })
        .catch(function(error) {
          if (typeof window.logger !== 'undefined') {
            window.logger.warn('[FinanzRechner] Service Worker registration failed:', error);
          }
        });
    });
  }
})();
