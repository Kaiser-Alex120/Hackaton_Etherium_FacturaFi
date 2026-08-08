/* ============================================================
   FacturaFi — api.js
   ============================================================
   ESTA ES LA CAPA QUE TU COMPAÑERO DE BACKEND VA A REEMPLAZAR.

   Todo el HTML/CSS y el resto del JS (dashboard.js, pool.js,
   registro.js, index.js) llama SOLO a las funciones de FF.api.
   Nunca tocan localStorage ni pricing.js directamente.

   Eso significa que para conectar el backend/smart contract real,
   basta con reescribir el cuerpo de cada función de este archivo
   (por ejemplo, cambiar `FF.db.getFacturas()` por
   `await fetch('/api/facturas').then(r => r.json())`, o por una
   llamada a ethers.js/wagmi contra el contrato) SIN cambiar nada
   en las páginas ni en los otros archivos JS.

   Todas las funciones son async y devuelven Promesas — aunque hoy
   se resuelvan contra localStorage, en el HTML ya se consumen con
   await/.then(), tal como se consumiría una llamada real a la API.

   Mapeo sugerido con el contrato (ver Anexo-Tecnico-Ethereum):
   - crearFactura           -> mint del token de factura (ERC-721)
   - tokenizarYFinanciar    -> aprobación + transferFrom del pool a la PYME
   - simularPagoATiempo     -> función `pagar()` del contrato + reparto a LPs
   - simularAtraso          -> oráculo/cron detecta mora, actualiza estado
   - marcarDefault          -> ejecuta cobertura del fondo de garantía (Capa 4)
   - depositar/retirar      -> deposit()/withdraw() del contrato de Pool
   ============================================================ */

window.FF = window.FF || {};

FF.api = (function () {
  const { db, pricing } = FF;

  function delay(ms = 260) {
    return new Promise((res) => setTimeout(res, ms));
  }

  function nowISO() { return new Date().toISOString(); }

  function addDays(iso, dias) {
    const d = new Date(iso);
    d.setDate(d.getDate() + dias);
    return d.toISOString();
  }

  function historial(factura, evento) {
    factura.historial = factura.historial || [];
    factura.historial.push({ fecha: nowISO(), evento });
  }

  // Notificación por WhatsApp (ver whatsapp-bot/) — si el bot local no
  // está corriendo, esto falla en silencio y no afecta el resto de la app.
  const WHATSAPP_BOT_URL = 'http://localhost:3001/notificar';
  function notificarWhatsApp(telefono, mensaje) {
    if (!telefono) return;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 1500);
    fetch(WHATSAPP_BOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono, mensaje }),
      signal: ctrl.signal,
    })
      .catch(() => { /* bot no está corriendo — silencioso, no rompe la demo */ })
      .finally(() => clearTimeout(timeout));
  }

  // ---------------------------------------------------------
  // PYME
  // ---------------------------------------------------------
  async function registrarPyme({ nombre, ruc, rubro, wallet, email, telefono }) {
    await delay();
    const pyme = {
      id: db.uid('pyme'),
      nombre, ruc, rubro, email, telefono,
      wallet: wallet || db.fakeWallet(),
      score: 0,           // todo usuario nace en 0 y construye su historial on-chain hacia arriba
      scoreMax: 10,
      operacionesTotales: 0,
      liquidezRecibidaTotal: 0,
      createdAt: nowISO(),
    };
    db.savePyme(pyme);
    return pyme;
  }

  async function getPyme() {
    await delay(80);
    return db.getPyme();
  }

  async function cerrarSesion() {
    await delay(120);
    db.clearAll();
    return true;
  }

  // Perfil editable — foto, contacto y link de la MYPE (Documento §14: datos
  // personales viven off-chain / en la app, no en el smart contract)
  async function actualizarPerfil({ email, telefono, sitioWeb, foto, wallet, pitch, buscaInversion, montoBuscado, tiposFinanciamiento }) {
    await delay(300);
    const pyme = db.getPyme();
    if (!pyme) throw new Error('No hay PYME registrada');
    if (email !== undefined) pyme.email = email;
    if (telefono !== undefined) pyme.telefono = telefono;
    if (sitioWeb !== undefined) pyme.sitioWeb = sitioWeb;
    if (foto !== undefined) pyme.foto = foto; // dataURL o null para quitarla
    if (wallet !== undefined) pyme.wallet = wallet;
    if (pitch !== undefined) pyme.pitch = pitch; // descripción del negocio, visible en el ranking de PYMEs
    if (buscaInversion !== undefined) pyme.buscaInversion = buscaInversion; // se destaca en el ranking del pool
    if (montoBuscado !== undefined) pyme.montoBuscado = montoBuscado; // monto a negociar directo con el inversionista
    if (tiposFinanciamiento !== undefined) pyme.tiposFinanciamiento = tiposFinanciamiento; // más allá de la venta de facturas — visible con score 4+
    db.savePyme(pyme);
    return pyme;
  }

  // ---------------------------------------------------------
  // INVERSIONISTA — sesión independiente de la PYME (Documento §11)
  // ---------------------------------------------------------
  const SALDO_BIENVENIDA = 10000; // USDC ficticios de bienvenida al registrarse

  async function registrarInversionista({ nombre, email, telefono }) {
    await delay();
    const inv = {
      id: db.uid('inv'),
      nombre, email, telefono,
      wallet: db.fakeWallet(),
      foto: null,
      saldoUSDC: SALDO_BIENVENIDA,
      posiciones: [], // { facturaId, montoInvertido, fecha }
      createdAt: nowISO(),
    };
    db.saveInversionista(inv);
    return inv;
  }

  async function getInversionista() {
    await delay(80);
    return db.getInversionista();
  }

  async function cerrarSesionInversionista() {
    await delay(120);
    db.clearInversionista();
    return true;
  }

  async function actualizarPerfilInversionista({ email, telefono, foto, wallet }) {
    await delay(300);
    const inv = db.getInversionista();
    if (!inv) throw new Error('No hay inversionista registrado');
    if (email !== undefined) inv.email = email;
    if (telefono !== undefined) inv.telefono = telefono;
    if (foto !== undefined) inv.foto = foto;
    if (wallet !== undefined) inv.wallet = wallet;
    db.saveInversionista(inv);
    return inv;
  }

  // "Comprar" una factura tokenizada específica del marketplace — reserva
  // parte del saldo simulado del inversionista contra esa operación puntual.
  async function comprarOpcion(facturaId, monto) {
    await delay(400);
    const inv = db.getInversionista();
    if (!inv) throw new Error('Regístrate como inversionista primero');
    const montoNum = Number(monto);
    if (!montoNum || montoNum <= 0) throw new Error('Ingresa un monto válido');
    if (montoNum > inv.saldoUSDC) throw new Error('No tienes saldo suficiente para esta compra');

    const facturas = db.getFacturas();
    const factura = facturas.find((f) => f.id === facturaId);
    if (!factura) throw new Error('Factura no encontrada');
    if (!factura.sc) throw new Error('Esta factura todavía no fue tokenizada');

    inv.saldoUSDC -= montoNum;
    inv.posiciones.push({ facturaId, montoInvertido: montoNum, fecha: nowISO() });
    db.saveInversionista(inv);

    historial(factura, `Tu solicitud fue adquirida por ${inv.nombre} — ${montoNum.toLocaleString('en-US')} USDC depositados a tu favor`);
    db.saveFacturas(facturas);

    return inv;
  }

  async function getPosicionesInversionista() {
    await delay(120);
    const inv = db.getInversionista();
    if (!inv) return [];
    const facturas = db.getFacturas();
    return inv.posiciones.map((p) => ({
      ...p,
      factura: facturas.find((f) => f.id === p.facturaId) || null,
    }));
  }

  // ---------------------------------------------------------
  // FACTURAS — ciclo de vida (Documento §5 y §10)
  // pendiente -> financiada -> pagada
  //                        \-> en_mora -> pagada (tardío) | default
  // ---------------------------------------------------------
  async function crearFactura({ monto, deudor, riesgoDeudor, dias }) {
    await delay();
    const pyme = db.getPyme();
    if (!pyme) throw new Error('No hay PYME registrada');

    const facturas = db.getFacturas();
    const factura = {
      id: db.uid('fac'),
      pymeId: pyme.id,
      monto: Number(monto),
      deudor,
      riesgoDeudor,          // 'bajo' | 'medio' | 'alto' — usado en la prima de riesgo del pagador
      dias: Number(dias),
      estado: 'pendiente',   // Etapa 2: registrada, aún no tokenizada/financiada
      tokenId: null,
      scoreAlEmitir: pyme.score,
      fechaEmision: nowISO(),
      fechaFinanciamiento: null,
      fechaVencimiento: null,
      historial: [],
    };
    historial(factura, 'Factura registrada por la PYME');
    facturas.unshift(factura);
    db.saveFacturas(facturas);
    return factura;
  }

  async function getFacturas() {
    await delay(120);
    const pyme = db.getPyme();
    if (!pyme) return [];
    return db.getFacturas().filter((f) => f.pymeId === pyme.id);
  }

  async function getFactura(id) {
    await delay(60);
    return db.getFacturas().find((f) => f.id === id) || null;
  }

  // Etapa 2 (tokenización) + Etapa 3 (el SC calcula pricing y financia)
  async function tokenizarYFinanciar(id) {
    await delay(500); // simula tiempo de "minado" — bueno para mostrar el spinner en demo
    const facturas = db.getFacturas();
    const factura = facturas.find((f) => f.id === id);
    if (!factura) throw new Error('Factura no encontrada');
    if (factura.estado !== 'pendiente') throw new Error('La factura ya fue tokenizada');

    const pyme = db.getPyme();
    const pool = db.getPool();
    const utilizacionPool = db.utilizacion(pool);

    const op = pricing.calcularOperacion({
      monto: factura.monto,
      dias: factura.dias,
      riesgoDeudor: factura.riesgoDeudor,
      score: pyme.score,
      utilizacionPool,
    });

    Object.assign(factura, {
      estado: 'financiada',
      tokenId: db.fakeTokenId(),
      fechaFinanciamiento: nowISO(),
      fechaVencimiento: addDays(nowISO(), factura.dias),
      // campos del SC — Documento §5 Etapa 3
      sc: {
        score: pyme.score,
        cant_$: factura.monto,
        tiempo_devol: factura.dias,
        '%_extra': op.tasaFinal,
      },
      pricing: op,
    });
    historial(factura, `Tokenizada (${factura.tokenId.slice(0, 10)}…) y financiada por el pool`);
    db.saveFacturas(facturas);

    pool.liquidezPrestada += op.precioDescontado;
    db.savePool(pool);

    pyme.operacionesTotales += 1;
    pyme.liquidezRecibidaTotal += op.liberadoInicial;
    db.savePyme(pyme);

    notificarWhatsApp(pyme.telefono, `FacturaFi: tu factura de ${factura.deudor} (S/ ${factura.monto.toLocaleString('es-PE')}) fue tokenizada y financiada. Recibiste S/ ${Math.round(op.liberadoInicial).toLocaleString('es-PE')} hoy en tu wallet.`);

    return factura;
  }

  // Rama A del ciclo de vida (Documento §10)
  async function simularPagoATiempo(id) {
    await delay(400);
    const facturas = db.getFacturas();
    const factura = facturas.find((f) => f.id === id);
    if (!factura) throw new Error('Factura no encontrada');
    if (!['financiada', 'en_mora'].includes(factura.estado)) throw new Error('Estado inválido');

    const eraMora = factura.estado === 'en_mora';
    factura.estado = 'pagada';
    factura.fechaPago = nowISO();
    historial(factura, eraMora ? 'Pago tardío confirmado — retención liberada' : 'Pago confirmado a tiempo — retención liberada (Capa 2)');
    db.saveFacturas(facturas);

    const pool = db.getPool();
    pool.liquidezPrestada -= factura.pricing.precioDescontado;
    pool.liquidezTotal += factura.pricing.descuentoTotal; // ganancia repartida a los prestamistas
    db.savePool(pool);

    const pyme = db.getPyme();
    if (!eraMora) {
      pyme.score = Math.min(pyme.scoreMax, pyme.score + 1);
    }
    db.savePyme(pyme);

    notificarWhatsApp(pyme.telefono, `FacturaFi: ¡tu factura de ${factura.deudor} fue pagada! El retorno ya se repartió a los prestamistas. Tu score ahora es ${pyme.score}/10.`);

    return factura;
  }

  // Rama B del ciclo de vida — atraso (Documento §7 / §10, Anexo-Matematico §2.3)
  async function simularAtraso(id, severidad = 'leve') {
    await delay(400);
    const facturas = db.getFacturas();
    const factura = facturas.find((f) => f.id === id);
    if (!factura) throw new Error('Factura no encontrada');
    if (factura.estado !== 'financiada') throw new Error('Solo una factura financiada puede entrar en mora');

    const deltas = { leve: -2, moderado: -4, severo: -7 };
    const etiquetas = {
      leve: 'Atraso leve (hasta 30 días)',
      moderado: 'Atraso moderado (31-90 días)',
      severo: 'Atraso severo (más de 90 días)',
    };
    factura.estado = 'en_mora';
    factura.severidadMora = severidad;
    historial(factura, `${etiquetas[severidad]} — Capa 2 (retención) amortigua, Capa 3 (score) penaliza`);
    db.saveFacturas(facturas);

    const pyme = db.getPyme();
    pyme.score = Math.max(0, pyme.score + deltas[severidad]);
    db.savePyme(pyme);

    notificarWhatsApp(pyme.telefono, `FacturaFi: tu factura de ${factura.deudor} entró en atraso (${etiquetas[severidad]}). Tu score bajó a ${pyme.score}/10. La retención (Capa 2) ya está amortiguando la pérdida.`);

    return factura;
  }

  // Default total — activa la Capa 4 (fondo de garantía)
  async function marcarDefault(id) {
    await delay(450);
    const facturas = db.getFacturas();
    const factura = facturas.find((f) => f.id === id);
    if (!factura) throw new Error('Factura no encontrada');
    if (factura.estado !== 'en_mora') throw new Error('Solo una factura en mora puede pasar a default');

    factura.estado = 'default';
    historial(factura, 'Default total — Capa 4 (fondo de garantía) cubre la pérdida residual');
    db.saveFacturas(facturas);

    const pool = db.getPool();
    pool.liquidezPrestada -= factura.pricing.precioDescontado;
    pool.fondoGarantia = Math.max(0, pool.fondoGarantia - factura.pricing.precioDescontado);
    db.savePool(pool);

    const pyme = db.getPyme();
    pyme.score = 0;
    db.savePyme(pyme);

    notificarWhatsApp(pyme.telefono, `FacturaFi: tu factura de ${factura.deudor} cayó en default. El fondo de garantía (Capa 4) cubrió la pérdida de los prestamistas. Tu score se reinició — puedes reconstruirlo con nuevas operaciones bien pagadas.`);

    return factura;
  }

  // ---------------------------------------------------------
  // POOL / PRESTAMISTAS (Documento §11)
  // ---------------------------------------------------------

  // Vista agregada para el prestamista — en un backend real sería una
  // query cruzando todas las PYMEs, no solo la sesión activa.
  async function getFacturasFinanciadas() {
    await delay(150);
    return db.getFacturas().filter((f) => ['financiada', 'pagada', 'en_mora', 'default'].includes(f.estado));
  }

  async function getPool() {
    await delay(120);
    const pool = db.getPool();
    return { ...pool, utilizacion: db.utilizacion(pool) };
  }

  async function depositar(monto) {
    await delay(400);
    const pool = db.getPool();
    pool.liquidezTotal += Number(monto);
    pool.prestamistas.push({ id: db.uid('lp'), wallet: db.fakeWallet(), monto: Number(monto), fecha: nowISO() });
    db.savePool(pool);
    return pool;
  }

  async function retirar(monto) {
    await delay(400);
    const pool = db.getPool();
    const disponible = pool.liquidezTotal - pool.liquidezPrestada;
    if (Number(monto) > disponible) throw new Error('Liquidez disponible insuficiente para retirar ese monto');
    pool.liquidezTotal -= Number(monto);
    db.savePool(pool);
    return pool;
  }

  return {
    registrarPyme, getPyme, cerrarSesion, actualizarPerfil,
    crearFactura, getFacturas, getFactura,
    tokenizarYFinanciar, simularPagoATiempo, simularAtraso, marcarDefault,
    getPool, depositar, retirar, getFacturasFinanciadas,
    registrarInversionista, getInversionista, cerrarSesionInversionista,
    actualizarPerfilInversionista, comprarOpcion, getPosicionesInversionista,
  };
})();
