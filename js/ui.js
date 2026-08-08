/* ============================================================
   FacturaFi — ui.js
   Helpers de presentación compartidos entre páginas:
   formato de moneda/%, toasts, modales, badges de estado, gauge de score.
   ============================================================ */

window.FF = window.FF || {};

FF.ui = (function () {

  // ---------- Formato ----------
  function soles(n) {
    return 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  function solesDec(n) {
    return 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function usdc(n) {
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' USDC';
  }
  function pct(n, dec = 1) {
    return (n * 100).toFixed(dec) + '%';
  }

  const ICON_CAL = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>';

  function fecha(iso) {
    if (!iso) return '<span class="date-chip">—</span>';
    const txt = new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
    return `<span class="date-chip">${ICON_CAL}${txt}</span>`;
  }
  function fechaHora(iso) {
    if (!iso) return '<span class="date-chip">—</span>';
    const txt = new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<span class="date-chip">${ICON_CAL}${txt}</span>`;
  }
  function corto(str, n = 10) {
    if (!str) return '—';
    return str.slice(0, n) + '…';
  }

  const ESTADO_LABEL = {
    pendiente: 'Pendiente', financiada: 'Financiada', pagada: 'Pagada',
    en_mora: 'En mora', default: 'Default',
  };
  function badgeEstado(estado) {
    return `<span class="badge badge-${estado}">${ESTADO_LABEL[estado] || estado}</span>`;
  }

  // ---------- Score gauge (0-10) ----------
  // Tiers oficiales del score (0-10): 0-3 Alto riesgo · 4-7 Medio · 8-10 Bajo
  function scoreColor(score) {
    if (score >= 8) return 'var(--emerald)';
    if (score >= 4) return 'var(--stone)';
    return 'var(--oxblood)';
  }
  function scoreLabel(score) {
    if (score >= 8) return 'Riesgo bajo';
    if (score >= 4) return 'Riesgo medio';
    return 'Riesgo alto';
  }
  function gaugeHTML(score, max = 10) {
    const color = scoreColor(score);
    const deg = Math.max(0, Math.min(1, score / max)) * 360;
    return `
      <div class="gauge-wrap">
        <div class="gauge" style="background:conic-gradient(${color} ${deg}deg, var(--surface-3) ${deg}deg)">
          <span style="color:${color}">${score}</span>
        </div>
        <div class="gauge-meta">
          <div class="t">Score on-chain</div>
          <div class="d" style="color:${color}">${scoreLabel(score)} · ${score}/${max}</div>
        </div>
      </div>`;
  }

  // ---------- Toasts ----------
  let stack;
  function ensureStack() {
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }
  function toast(msg, type = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'warn' ? ' warn' : type === 'error' ? ' error' : '');
    el.textContent = msg;
    ensureStack().appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 260);
    }, 3200);
  }

  // ---------- Modales ----------
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  }
  function bindModalDismiss() {
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach((o) => o.classList.remove('open'));
      }
    });
  }

  // ---------- Guard de sesión ----------
  async function requirePyme() {
    const pyme = await FF.api.getPyme();
    if (!pyme) {
      window.location.href = 'registro.html';
      return null;
    }
    return pyme;
  }

  async function requireInversionista() {
    const inv = await FF.api.getInversionista();
    if (!inv) {
      window.location.href = 'registro-inversionista.html';
      return null;
    }
    return inv;
  }

  function initials(nombre) {
    return (nombre || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }

  return {
    soles, solesDec, usdc, pct, fecha, fechaHora, corto,
    badgeEstado, scoreColor, scoreLabel, gaugeHTML,
    toast, openModal, closeModal, bindModalDismiss,
    requirePyme, requireInversionista, initials,
  };
})();

// Reveal-on-scroll: aplica en cualquier página que tenga elementos .reveal
function bindReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        entry.target.style.transitionDelay = (i % 4) * 70 + 'ms';
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  els.forEach((el) => io.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
  FF.ui.bindModalDismiss();
  bindReveal();
});
