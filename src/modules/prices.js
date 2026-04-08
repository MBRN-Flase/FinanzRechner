export async function fetchPrices({ setText, formatCurrency, formatCurrencyShort, backend }) {
  if (backend && typeof backend.getCryptoPrices === 'function') {
    try {
      const response = await backend.getCryptoPrices();
      if (!response.success || !response.data) throw new Error('Invalid response');

      const btc = response.data.bitcoin?.eur;
      const eth = response.data.ethereum?.eur;
      setText('btc-price', btc ? formatCurrency(btc) : '~84.000 EUR');
      setText('eth-price', eth ? formatCurrency(eth) : '~2.000 EUR');
      if (btc) setText('btc-scenario-rate', `BTC @ ${formatCurrencyShort(btc)}`);
      return;
    } catch {
      // fall back below
    }
  }

  setText('btc-price', '~84.000 EUR');
  setText('eth-price', '~2.000 EUR');

  const tickerInner = document.getElementById('ticker-inner');
  if (tickerInner && !document.getElementById('api-warning')) {
    const warning = document.createElement('span');
    warning.id = 'api-warning';
    warning.className = 'ticker-label';
    warning.style.color = 'var(--gold)';
    warning.textContent = '(Fallback-Preise)';
    tickerInner.appendChild(warning);
  }
}
