/* ============================================================
   FacturaFi — mockdb.js
   "Base de datos" simulada en localStorage. Hace las veces de
   blockchain + backend mientras no está conectado el contrato real.

   Todo lo que un desarrollador de backend necesita saber para
   reemplazar esto está documentado en api.js (léelo primero).
   ============================================================ */

window.FF = window.FF || {};

FF.db = (function () {

  const KEYS = {
    pyme: 'facturafi_pyme',
    facturas: 'facturafi_facturas',
    pool: 'facturafi_pool',
    inversionista: 'facturafi_inversionista',
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('FF.db: error leyendo', key, e);
      return fallback;
    }
  }
  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function uid(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 9);
  }

  // Simula un hash de token on-chain (Etapa 2 — tokenización)
  function fakeTokenId() {
    const chars = '0123456789abcdef';
    let hex = '0x';
    for (let i = 0; i < 40; i++) hex += chars[Math.floor(Math.random() * 16)];
    return hex;
  }

  function fakeWallet() {
    return fakeTokenId();
  }

  // ---------- Estado inicial del pool (Etapa 3 / vista prestamista) ----------
  // El pool nace vacío — como un protocolo recién lanzado. Desde la vista del
  // prestamista hay un botón para cargar fondos de prueba (+10,000 USDC).
  function defaultPool() {
    return {
      liquidezTotal: 0,
      liquidezPrestada: 0,
      fondoGarantia: 0,
      prestamistas: [],
    };
  }

  function daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }

  // ---------- PYME ----------
  function getPyme() { return read(KEYS.pyme, null); }
  function savePyme(pyme) { return write(KEYS.pyme, pyme); }
  // Cierra solo la sesión de la PYME — las facturas ya tokenizadas y el
  // estado del pool son datos del marketplace (los ve el inversionista),
  // no de la sesión: no se borran al cerrar sesión.
  function clearAll() {
    localStorage.removeItem(KEYS.pyme);
  }

  // ---------- Inversionista (independiente de la sesión PYME) ----------
  function getInversionista() { return read(KEYS.inversionista, null); }
  function saveInversionista(inv) { return write(KEYS.inversionista, inv); }
  function clearInversionista() { localStorage.removeItem(KEYS.inversionista); }

  // ---------- Facturas ----------
  function getFacturas() { return read(KEYS.facturas, []); }
  function saveFacturas(list) { return write(KEYS.facturas, list); }

  // ---------- Pool ----------
  function getPool() {
    let pool = read(KEYS.pool, null);
    if (!pool) pool = write(KEYS.pool, defaultPool());
    return pool;
  }
  function savePool(pool) { return write(KEYS.pool, pool); }

  function utilizacion(pool) {
    if (!pool.liquidezTotal) return 0;
    return pool.liquidezPrestada / pool.liquidezTotal;
  }

  return {
    KEYS, uid, fakeTokenId, fakeWallet, daysAgoISO,
    getPyme, savePyme, clearAll,
    getFacturas, saveFacturas,
    getPool, savePool, utilizacion,
    getInversionista, saveInversionista, clearInversionista,
  };
})();
