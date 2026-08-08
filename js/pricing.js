/* ============================================================
   FacturaFi — pricing.js
   Fórmulas del protocolo, tal como están definidas en:
   - Documento-Producto-Extenso §9 (lógica de pricing)
   - Anexo-Teorico-Matematico §2.5 (prima de riesgo por score)
   - Anexo-Tecnico-Ethereum §2 (curva kinked por utilización) y §6 (health factor)

   Estos parámetros son ajustables — lo importante es que la fórmula
   quede documentada y sea la misma que usa dashboard.js / pool.js.
   ============================================================ */

window.FF = window.FF || {};

FF.pricing = (function () {

  const CONFIG = {
    tasaBase: 0.02,          // piso de rentabilidad para atraer liquidez al pool
    factorPlazo: 0.10,       // sensibilidad de la tasa al plazo (anualizada)
    primaBaseRiesgoScore: 0.06, // prima máxima por score en el mínimo (score 0)
    scoreMax: 10,             // escala 0-10 (MVP; ver Anexo-Matematico para escala 0-1,000,000)
    feeOriginacion: 0.01,     // fee de FacturaFi (~1%, sección 17)
    retencion: 0.07,          // % retenido hasta confirmar pago — Capa 2 (rango doc: 5-9%)
    util: { uOptimo: 0.80, pendiente1: 0.02, pendiente2: 0.16 }, // curva kinked, Anexo Ethereum §2
  };

  const RIESGO_DEUDOR = {
    bajo:  { label: 'Bajo',  prima: 0.005 },
    medio: { label: 'Medio', prima: 0.015 },
    alto:  { label: 'Alto',  prima: 0.035 },
  };

  // Anexo-Matematico §2.5 — prima de riesgo por score
  function primaRiesgoScore(score, scoreMax = CONFIG.scoreMax) {
    const s = Math.max(0, Math.min(score, scoreMax));
    return CONFIG.primaBaseRiesgoScore * (1 - s / scoreMax);
  }

  // Anexo-Ethereum §2 — curva "kinked rate" por utilización del pool
  function ajustePorUtilizacion(u, cfg = CONFIG.util) {
    const U = Math.max(0, Math.min(u, 1));
    const { uOptimo, pendiente1, pendiente2 } = cfg;
    if (U <= uOptimo) return (U / uOptimo) * pendiente1;
    return pendiente1 + ((U - uOptimo) / (1 - uOptimo)) * pendiente2;
  }

  // Documento-Producto-Extenso §9 — fórmula base + ajuste por utilización
  function calcularTasa({ dias, riesgoDeudor = 'medio', score, utilizacionPool = 0.5 }) {
    const primaDeudor = (RIESGO_DEUDOR[riesgoDeudor] || RIESGO_DEUDOR.medio).prima;
    const tasaDescuento =
      CONFIG.tasaBase +
      CONFIG.factorPlazo * (dias / 365) +
      primaDeudor +
      primaRiesgoScore(score);

    const ajusteUtil = ajustePorUtilizacion(utilizacionPool);
    const tasaFinalRaw = tasaDescuento + ajusteUtil;
    const tasaFinal = Math.max(0.01, Math.min(tasaFinalRaw, 0.35));

    return { tasaDescuento, ajusteUtil, tasaFinal, primaDeudor, primaScore: primaRiesgoScore(score) };
  }

  // Desglose monetario completo de una operación (para el "recibo" del SC)
  function calcularOperacion({ monto, dias, riesgoDeudor, score, utilizacionPool }) {
    const t = calcularTasa({ dias, riesgoDeudor, score, utilizacionPool });

    const precioDescontado = monto * (1 - t.tasaFinal); // lo que paga el pool hoy
    const descuentoTotal = monto - precioDescontado;     // ganancia del pool al vencimiento
    const fee = monto * CONFIG.feeOriginacion;            // fee FacturaFi (sección 17)
    const brutoPyme = precioDescontado - fee;             // "lo que recibe la PYME" antes de retención
    const retenido = brutoPyme * CONFIG.retencion;        // Capa 2 — retención parcial
    const liberadoInicial = brutoPyme - retenido;         // liberado de inmediato a la PYME

    const retornoPrestamista = monto;                     // recibe el valor nominal al vencimiento
    const retornoPct = descuentoTotal / precioDescontado;  // retorno % sobre lo invertido

    return {
      ...t,
      monto, dias,
      precioDescontado, descuentoTotal, fee, brutoPyme, retenido, liberadoInicial,
      retornoPrestamista, retornoPct,
    };
  }

  // Anexo-Ethereum §6 — health factor del pool
  function healthFactor({ fondoGarantia, liquidezDisponible, factorLiquidacion = 0.8, exposicionTotal }) {
    if (!exposicionTotal) return Infinity;
    return (fondoGarantia + liquidezDisponible * factorLiquidacion) / exposicionTotal;
  }

  return { CONFIG, RIESGO_DEUDOR, primaRiesgoScore, ajustePorUtilizacion, calcularTasa, calcularOperacion, healthFactor };
})();
