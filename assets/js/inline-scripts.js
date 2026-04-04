/**
 * INLINE SCRIPTS - FinanzRechner
 * Ehemals inline im HTML, jetzt extern für CSP Compliance
 */

'use strict';

// 1. Legal Modal Functions
window.openLegalModal = function() {
  document.getElementById('legal-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeLegalModal = function() {
  document.getElementById('legal-modal').classList.remove('active');
  document.body.style.overflow = '';
};

// 2. Theme Toggle
document.addEventListener('DOMContentLoaded', function(){
  const btn = document.getElementById('frThemeBtn');
  if(!btn) return;
  
  // Load saved theme
  const saved = localStorage.getItem('fr-theme');
  const theme = saved || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  
  const isDark = theme === 'dark';
  btn.textContent = isDark ? '☀' : '☾';
  btn.setAttribute('aria-label', isDark ? 'Light Mode aktivieren' : 'Dark Mode aktivieren');
  
  btn.addEventListener('click', function(){
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('fr-theme', next);
    btn.textContent = next === 'dark' ? '☀' : '☾';
    btn.setAttribute('aria-label', next === 'dark' ? 'Light Mode aktivieren' : 'Dark Mode aktivieren');
  });
});

// 3. Legal Modal Event Listeners
document.addEventListener('DOMContentLoaded', function(){
  const legalModal = document.getElementById('legal-modal');
  const closeBtn = document.getElementById('legalModalClose');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', window.closeLegalModal);
  }
  
  if (legalModal) {
    legalModal.addEventListener('click', function(e) {
      if (e.target === this) window.closeLegalModal();
    });
  }
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') window.closeLegalModal();
  });
});

// 4. PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log('[PWA] Service Worker aktiv'))
    .catch((err) => console.log('[PWA] Fehler', err));
}
