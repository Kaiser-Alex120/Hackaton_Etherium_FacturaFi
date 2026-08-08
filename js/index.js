/* ============================================================
   FacturaFi — index.js
   Calculadora de pricing en vivo para la landing. Usa FF.pricing
   directamente (no requiere sesión ni FF.api) para que cualquier
   visitante pueda jugar con la fórmula sin registrarse.
   ============================================================ */

// Contador animado en el stat-strip — cuenta hacia arriba al entrar en viewport
(function () {
  const els = document.querySelectorAll('[data-count-to]');
  if (!els.length) return;

  function anima(el) {
    const target = parseFloat(el.dataset.countTo);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const decimals = Number(el.dataset.decimals || 0);
    const dur = 1200;
    let inicio = null;

    function tick(ts) {
      if (inicio === null) inicio = ts;
      const p = Math.min(1, (ts - inicio) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = target * eased;
      el.textContent = prefix + val.toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      anima(entry.target);
    });
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
})();

// Mock-card del hero: cicla entre escenarios reales del ciclo de vida
// para que el mockup se sienta vivo en vez de una captura estática.
(function () {
  const card = document.getElementById('mock-card');
  const badge = document.getElementById('mc-badge');
  if (!card || !badge) return;

  const el = {
    deudor: document.getElementById('mc-deudor'),
    monto: document.getElementById('mc-monto'),
    dias: document.getElementById('mc-dias'),
    tasa: document.getElementById('mc-tasa'),
    score: document.getElementById('mc-score'),
    liberado: document.getElementById('mc-liberado'),
    token: document.getElementById('mc-token'),
  };

  // Misma PYME, mismo plazo (45 días) — el score subiendo de 0 a 9 es lo único
  // que cambia, para mostrar en la propia landing cómo mejora la tasa.
  const escenarios = [
    { deudor: 'Textiles del Sur E.I.R.L.', monto: 'S/ 5,000', dias: 45, tasa: '12.0%', score: '0 / 10', liberado: 'S/ 4,046', token: '0x71fa3…c9e2', estado: 'financiada', label: 'Financiada' },
    { deudor: 'Comercial Andina S.A.C.', monto: 'S/ 8,000', dias: 45, tasa: '9.0%', score: '5 / 10', liberado: 'S/ 6,697', token: '0x9c2e1…4b7a', estado: 'financiada', label: 'Financiada' },
    { deudor: 'Ferretería San Martín', monto: 'S/ 12,000', dias: 45, tasa: '5.6%', score: '9 / 10', liberado: 'S/ 10,425', token: '0x3af90…d21c', estado: 'pagada', label: 'Pagada' },
  ];

  function render(e) {
    badge.className = 'badge badge-' + e.estado;
    badge.textContent = e.label;
    el.deudor.textContent = e.deudor;
    el.monto.textContent = e.monto;
    el.dias.textContent = e.dias;
    el.tasa.textContent = e.tasa;
    el.score.textContent = e.score;
    el.liberado.textContent = e.liberado;
    el.token.textContent = e.token;
  }

  let i = 0;
  setInterval(() => {
    i = (i + 1) % escenarios.length;
    card.classList.add('mc-fade');
    setTimeout(() => {
      render(escenarios[i]);
      card.classList.remove('mc-fade');
    }, 260);
  }, 4200);
})();

(function () {
  const $ = (id) => document.getElementById(id);
  const inMonto = $('in-monto'), inFechaEmision = $('in-fecha-emision'), inFechaVencimiento = $('in-fecha-vencimiento'), inScore = $('in-score');
  if (!inMonto) return; // esta página no tiene la calculadora

  // Utilización fija de referencia — el control interactivo vive en la
  // calculadora de retorno del prestamista (pool.html), no aquí.
  const UTIL_REFERENCIA = 0.5;

  // El riesgo del pagador ya no se pide por separado — el score de la PYME
  // alcanza para mostrar cómo cambia la tasa. Queda fijo en "medio" (neutral).
  const riesgo = 'medio';
  let moneda = 'PEN';

  // Tasas de referencia para la demo — no son un feed en vivo.
  const FX = {
    PEN: { rate: 1, simbolo: 'S/ ', locale: 'es-PE', nota: 'Montos en soles peruanos.' },
    USD: { rate: 1 / 3.75, simbolo: '$ ', locale: 'en-US', nota: 'Referencia: 1 USD ≈ S/ 3.75 (no en vivo).' },
    CNY: { rate: 1 / 0.52, simbolo: '¥ ', locale: 'zh-CN', nota: 'Referencia: 1 CNY ≈ S/ 0.52 (no en vivo).' },
    EUR: { rate: 1 / 4.05, simbolo: '€ ', locale: 'es-ES', nota: 'Referencia: 1 EUR ≈ S/ 4.05 (no en vivo).' },
    MXN: { rate: 1 / 0.21, simbolo: 'MX$ ', locale: 'es-MX', nota: 'Referencia: 1 MXN ≈ S/ 0.21 (no en vivo).' },
  };
  function money(soles) {
    const cfg = FX[moneda];
    return cfg.simbolo + (soles * cfg.rate).toLocaleString(cfg.locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // Plazo por calendario: fecha de emisión → fecha de vencimiento. Los días
  // se calculan solos, igual que en el formulario real de "Nueva factura".
  function fechaISO(d) { return d.toISOString().slice(0, 10); }

  const hoy = new Date();
  inFechaEmision.value = fechaISO(hoy);
  inFechaVencimiento.min = fechaISO(new Date(hoy.getTime() + 86400000));
  inFechaVencimiento.value = fechaISO(new Date(hoy.getTime() + 60 * 86400000));

  function diasEntreFechas() {
    const emision = new Date((inFechaEmision.value || fechaISO(hoy)) + 'T00:00:00');
    const vencMin = new Date(emision.getTime() + 86400000);
    inFechaVencimiento.min = fechaISO(vencMin);
    let venc = new Date((inFechaVencimiento.value || fechaISO(vencMin)) + 'T00:00:00');
    if (venc < vencMin) {
      venc = vencMin;
      inFechaVencimiento.value = fechaISO(vencMin);
    }
    return Math.max(1, Math.round((venc - emision) / 86400000));
  }

  const segMoneda = document.getElementById('seg-moneda');
  if (segMoneda) {
    segMoneda.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        segMoneda.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        moneda = btn.dataset.v;
        render();
      });
    });
  }

  function render() {
    const monto = Number(inMonto.value);
    const dias = diasEntreFechas();
    const score = Number(inScore.value);

    $('v-monto').textContent = money(monto);
    $('v-dias').textContent = dias + ' días';
    $('v-score').textContent = score + ' / 10';

    const op = FF.pricing.calcularOperacion({ monto, dias, riesgoDeudor: riesgo, score, utilizacionPool: UTIL_REFERENCIA });

    $('out-recibe').textContent = money(op.liberadoInicial);
    $('out-recibe-sub').textContent = `de ${money(op.brutoPyme)} netos — ${money(op.retenido)} retenidos hasta confirmar el pago`;
    $('out-tasa').textContent = FF.ui.pct(op.tasaFinal, 2);
    $('out-desc').textContent = FF.ui.pct(FF.pricing.CONFIG.tasaBase + FF.pricing.CONFIG.factorPlazo * (dias / 365), 2);
    $('out-prima-score').textContent = FF.ui.pct(op.primaScore, 2);
    $('out-fee').textContent = money(op.fee);
    $('out-retorno').textContent = `${money(op.retornoPrestamista)} (+${FF.ui.pct(op.retornoPct, 2)})`;
    if ($('fx-nota')) $('fx-nota').textContent = FX[moneda].nota;
  }

  [inMonto, inScore].forEach((el) => el.addEventListener('input', render));
  [inFechaEmision, inFechaVencimiento].forEach((el) => el.addEventListener('change', render));
  render();
})();

