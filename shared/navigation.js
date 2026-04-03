/**
 * MBRN Shared Navigation Component
 * Injects consistent navigation across all MBRN tools
 * 
 * Usage: <script src="../shared/navigation.js"></script>
 * Place in <body> as first element for proper positioning
 */

(function() {
  'use strict';

  // Determine current tool for active state
  const currentUrl = window.location.href;
  const isNumerology = currentUrl.includes('NumerologieRechner') || currentUrl.includes('numerology');
  const isFinance = currentUrl.includes('FinanzRechner') || currentUrl.includes('finanz');
  const isDiscipline = currentUrl.includes('discipline-tracker') || currentUrl.includes('disziplin');

  // Navigation HTML template
  const navHTML = `
<nav class="topnav" id="mbrn-nav">
  <!-- Brand -->
  <a class="topnav-brand" href="https://flase-mbrn.github.io/MBRN/" target="_blank" rel="noopener" aria-label="MBRN Hauptwebsite">
    <span class="topnav-logo">✦</span>
    <span class="topnav-name">MBRN</span>
  </a>
  
  <!-- Navigation Links -->
  <div class="topnav-links" aria-label="Weitere Tools">
    <a class="topnav-link ${isFinance ? 'is-active' : ''}" href="https://flase-mbrn.github.io/FinanzRechner/" target="_blank" rel="noopener" data-tool="finance">
      <span class="nav-icon">💰</span>
      <span class="nav-text">Finanz</span>
    </a>
    <a class="topnav-link ${isDiscipline ? 'is-active' : ''}" href="https://flase-mbrn.github.io/discipline-tracker/" target="_blank" rel="noopener" data-tool="discipline">
      <span class="nav-icon">🔥</span>
      <span class="nav-text">Disziplin</span>
    </a>
    <a class="topnav-link ${isNumerology ? 'is-active' : ''}" href="https://flase-mbrn.github.io/NumerologieRechner/" target="_blank" rel="noopener" data-tool="numerology">
      <span class="nav-icon">✦</span>
      <span class="nav-text">Numerologie</span>
    </a>
  </div>
  
  <!-- Right Side: Support + Theme Toggle -->
  <div class="topnav-actions">
    <a class="topnav-support" href="https://ko-fi.com/flasembrn" target="_blank" rel="noopener" aria-label="Projekt unterstützen">
      <span class="support-icon">☕</span>
      <span class="support-text">Support</span>
    </a>
    <button class="theme-toggle" id="themeToggle" aria-label="Dark/Light Mode wechseln" title="Theme wechseln">
      <span class="theme-icon">🌓</span>
    </button>
  </div>
</nav>

<!-- Skip-Link für Accessibility -->
<a href="#main" class="skip-link">Zum Hauptinhalt springen</a>
`;

  // Inject navigation at the start of body
  function injectNavigation() {
    // Check if navigation already exists
    if (document.getElementById('mbrn-nav')) {
      console.log('[MBRN Nav] Already injected, skipping');
      return;
    }

    // Create container and insert
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = navHTML;
    
    // Insert before first child of body
    if (document.body.firstChild) {
      document.body.insertBefore(tempDiv.firstElementChild, document.body.firstChild);
      // Insert skip link after nav
      if (tempDiv.firstElementChild) {
        document.body.insertBefore(tempDiv.firstElementChild, document.body.firstChild);
      }
    } else {
      document.body.appendChild(tempDiv.firstElementChild);
    }

    // Initialize theme toggle if not already done
    initThemeToggle();
    
    console.log('[MBRN Nav] Navigation injected successfully');
  }

  // Theme toggle functionality
  function initThemeToggle() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;

    // Check if already initialized
    if (btn.dataset.initialized) return;
    btn.dataset.initialized = 'true';

    const saved = localStorage.getItem('nTheme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(btn, saved);

    btn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('nTheme', next);
      updateThemeIcon(btn, next);
      btn.setAttribute('aria-label', next === 'dark' ? 'Light Mode aktivieren' : 'Dark Mode aktivieren');
    });
  }

  function updateThemeIcon(btn, theme) {
    const icon = btn.querySelector('.theme-icon');
    if (icon) {
      icon.textContent = theme === 'dark' ? '☀' : '☾';
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNavigation);
  } else {
    injectNavigation();
  }

  // Also expose for manual initialization
  window.MBRN = window.MBRN || {};
  window.MBRN.initNavigation = injectNavigation;

})();
