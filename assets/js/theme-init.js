/**
 * FinanzRechner Theme Toggle Integration
 * External script for CSP compliance
 */

(function() {
  'use strict';
  
  document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('frThemeBtn');
    if (themeBtn && window.themeManager) {
      // Initial icon
      themeBtn.textContent = window.themeManager.isDark() ? '☀' : '☾';
      
      // Click handler
      themeBtn.addEventListener('click', () => {
        window.themeManager.toggle();
        themeBtn.textContent = window.themeManager.isDark() ? '☀' : '☾';
      });
      
      // Listen for theme changes
      window.themeManager.onChange((detail) => {
        themeBtn.textContent = detail.theme === 'dark' ? '☀' : '☾';
      });
    }
  });
})();
