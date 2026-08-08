/* ============================================================
   FacturaFi — web3ui.js
   Botón de wallet compartido por las 4 páginas. Se auto-monta en
   cualquier elemento con id="wallet-slot" — no requiere que cada
   página lo llame manualmente.
   ============================================================ */

window.FF = window.FF || {};

FF.web3ui = (function () {
  function render(el, s) {
    if (s.conectado) {
      el.innerHTML = `
        <button class="wallet-pill" data-wallet-action="disconnect" title="Click para desconectar">
          <span class="wallet-dot"></span> ${FF.web3.corto(s.address)}
        </button>`;
    } else {
      el.innerHTML = `
        <button class="btn btn-outline btn-sm" data-wallet-action="connect">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3"/><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4"/><path d="M17 12h3v4h-3a2 2 0 0 1 0-4Z"/></svg>
          Conectar wallet
        </button>`;
    }
  }

  function mount(id) {
    const el = document.getElementById(id);
    if (!el) return;

    render(el, FF.web3.estado());
    FF.web3.on((s) => render(el, s));

    el.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-wallet-action]');
      if (!btn) return;
      if (btn.dataset.walletAction === 'connect') await FF.web3.conectar();
      if (btn.dataset.walletAction === 'disconnect') FF.web3.desconectar();
    });
  }

  document.addEventListener('DOMContentLoaded', () => mount('wallet-slot'));

  return { mount };
})();
