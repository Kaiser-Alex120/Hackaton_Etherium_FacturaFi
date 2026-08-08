/* ============================================================
   FacturaFi — pool.js
   Vista del prestamista (Documento §11): liquidez, utilización,
   curva kinked de tasa (Anexo-Ethereum §2), health factor (§6).
   ============================================================ */

(function () {
  const { ui, api, pricing } = FF;
  let facturasActuales = [];
  let filtroActual = 'todas';
  let renderCalcRetorno = null;
  let utilCalcCargada = false;
  let inversionista = null;

  document.addEventListener('DOMContentLoaded', async () => {
    inversionista = await ui.requireInversionista();
    if (!inversionista) return;

    renderIdentidadInversionista(inversionista);
    bindAcciones();
    bindTabsRiesgo();
    bindCierreModales();
    bindModalPerfilInv();
    bindModalesMarketplace();
    renderCalcRetorno = bindCalculadoraRetorno();
    renderRanking();
    await refrescar();
    intentarDatosOnChain();
  });

  function bindCierreModales() {
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => ui.closeModal(btn.dataset.close));
    });
  }

  function renderIdentidadInversionista(inv) {
    const avatarEl = document.getElementById('inv-avatar');
    if (!avatarEl) return;
    avatarEl.innerHTML = inv.foto ? `<img src="${inv.foto}" alt="">` : ui.initials(inv.nombre);
    document.getElementById('inv-nombre').textContent = inv.nombre;
    document.getElementById('inv-saldo').textContent = ui.usdc(inv.saldoUSDC);
  }

  // Mismos tiers que el score de la PYME (ui.js): 0-3 alto · 4-7 medio · 8-10 bajo
  function tierKey(score) {
    if (score >= 8) return 'bajo';
    if (score >= 4) return 'medio';
    return 'alto';
  }
  const TIERS = [
    { key: 'bajo', label: 'Bajo', color: 'var(--emerald)' },
    { key: 'medio', label: 'Medio', color: 'var(--stone)' },
    { key: 'alto', label: 'Alto', color: 'var(--oxblood)' },
  ];

  // Lectura real del contrato desplegado — gratis, sin wallet, sin gas.
  // Si la red no coincide o el contrato no responde, el widget simplemente
  // no aparece — no rompe el resto de la demo.
  async function intentarDatosOnChain() {
    if (!FF.contract || !FF.contract.disponible()) return;
    try {
      const datos = await FF.contract.obtenerContadores();
      if (!datos) return;
      document.getElementById('onchain-contratos').textContent = datos.contratos;
      document.getElementById('onchain-facturas').textContent = datos.facturas;
      document.getElementById('onchain-address').textContent = FF.contractConfig.CONTRACT_ADDRESS;
      document.getElementById('onchain-card').style.display = 'flex';
    } catch (err) {
      console.info('Contrato on-chain no disponible en esta red — se omite el widget.', err.message);
    }
  }

  async function refrescar() {
    const pool = await api.getPool();
    const facturas = await api.getFacturasFinanciadas();

    const disponible = pool.liquidezTotal - pool.liquidezPrestada;
    const health = pricing.healthFactor({
      fondoGarantia: pool.fondoGarantia,
      liquidezDisponible: disponible,
      exposicionTotal: pool.liquidezPrestada || 1,
    });

    document.getElementById('kpi-total').textContent = ui.usdc(pool.liquidezTotal);
    document.getElementById('kpi-disponible').textContent = ui.usdc(disponible);
    document.getElementById('kpi-utilizacion').textContent = ui.pct(pool.utilizacion, 1);
    const healthEl = document.getElementById('kpi-health');
    healthEl.textContent = health === Infinity ? '∞' : health.toFixed(2);
    healthEl.style.color = health < 1 ? 'var(--oxblood)' : health < 1.5 ? 'var(--stone)' : 'var(--emerald)';

    document.getElementById('lista-lp').innerHTML = pool.prestamistas.slice().reverse().slice(0, 6).map((lp) => `
      <li class="flex-between" style="font-size:.82rem;">
        <span class="cell-mono muted">${ui.corto(lp.wallet, 12)}</span>
        <span class="cell-strong">${ui.usdc(lp.monto)}</span>
      </li>`).join('') || '<li class="faint" style="font-size:.82rem;">Sin depósitos todavía</li>';

    facturasActuales = facturas;
    renderComposicion(facturas);
    renderTablaFacturas();

    // Precarga la calculadora de retorno con la utilización real — solo
    // la primera vez, para no pisar los ajustes manuales del usuario después.
    if (!utilCalcCargada) {
      utilCalcCargada = true;
      const inUtil = document.getElementById('rin-util');
      if (inUtil) inUtil.value = Math.round(pool.utilizacion * 100);
    }
    if (renderCalcRetorno) renderCalcRetorno();
  }

  function renderComposicion(facturas) {
    const bar = document.getElementById('composicion-bar');
    const legend = document.getElementById('composicion-legend');
    if (!facturas.length) {
      bar.innerHTML = '';
      legend.innerHTML = '<span class="faint" style="font-size:.78rem;">Sin contratos tokenizados todavía.</span>';
      return;
    }
    const totales = { bajo: 0, medio: 0, alto: 0 };
    facturas.forEach((f) => { totales[tierKey(f.scoreAlEmitir)] += f.monto; });
    const total = totales.bajo + totales.medio + totales.alto;

    bar.innerHTML = TIERS.map((t) => {
      const pct = total ? (totales[t.key] / total) * 100 : 0;
      return pct > 0 ? `<span style="width:${pct}%; background:${t.color};"></span>` : '';
    }).join('');

    legend.innerHTML = TIERS.map((t) => {
      const pct = total ? Math.round((totales[t.key] / total) * 100) : 0;
      return `<span class="item"><span class="dot" style="background:${t.color};"></span>Riesgo ${t.label.toLowerCase()}: ${pct}% (${ui.soles(totales[t.key])})</span>`;
    }).join('');
  }

  function bindTabsRiesgo() {
    document.querySelectorAll('#tabs-riesgo .tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#tabs-riesgo .tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        filtroActual = btn.dataset.tier;
        renderTablaFacturas();
      });
    });
  }

  function renderTablaFacturas() {
    const tbody = document.getElementById('tabla-pool');
    const empty = document.getElementById('empty-pool');
    const filtradas = filtroActual === 'todas'
      ? facturasActuales
      : facturasActuales.filter((f) => tierKey(f.scoreAlEmitir) === filtroActual);

    document.getElementById('facturas-count').textContent = `${filtradas.length} factura${filtradas.length === 1 ? '' : 's'}`;

    if (!filtradas.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = filtradas.map((f) => {
      const t = TIERS.find((x) => x.key === tierKey(f.scoreAlEmitir));
      // "Pendiente a pago" desde la mirada del prestamista: el pool ya
      // financió a la PYME y se está esperando a que el deudor pague.
      const pendienteDePago = ['financiada', 'en_mora'].includes(f.estado);
      return `
      <tr>
        <td class="cell-mono">${ui.corto(f.tokenId, 12)}</td>
        <td class="cell-strong">${f.deudor}</td>
        <td>${ui.soles(f.monto)}</td>
        <td>${f.dias} días</td>
        <td class="cell-mono">${ui.pct(f.pricing.tasaFinal, 1)}</td>
        <td><span style="color:${t.color}; font-weight:700; font-size:.8rem;">${t.label}</span></td>
        <td>${ui.badgeEstado(f.estado)}</td>
        <td class="muted" style="font-size:.82rem;">${ui.fecha(f.fechaVencimiento)}</td>
        <td>
          <div class="flex gap-8">
            <button class="btn btn-outline btn-sm" data-comprar="${f.id}">Leer más</button>
            ${pendienteDePago ? `<button class="btn btn-primary btn-sm" data-contrato="${f.id}">Imprimir contrato</button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-comprar]').forEach((btn) => {
      btn.addEventListener('click', () => abrirComprar(btn.dataset.comprar));
    });
    tbody.querySelectorAll('[data-contrato]').forEach((btn) => {
      btn.addEventListener('click', () => abrirContratoDesdePool(btn.dataset.contrato));
    });
  }

  // -------------------- Depositar / retirar --------------------
  function bindAcciones() {
    document.getElementById('btn-logout-inv').addEventListener('click', async () => {
      await api.cerrarSesionInversionista();
      window.location.href = 'index.html';
    });

    // El fondeo depende de la wallet conectada (ver web3.js) — sin tarjeta
    // ficticia. El estado se refleja en vivo mientras conectas/desconectas.
    const elEstadoWallet = document.getElementById('fondeo-wallet-estado');
    function actualizarEstadoWallet(s) {
      if (!elEstadoWallet) return;
      s = s || FF.web3.estado();
      elEstadoWallet.textContent = s.conectado
        ? `Depositando desde tu wallet conectada: ${FF.web3.corto(s.address)}`
        : 'Conecta tu wallet en la barra de arriba para depositar desde tu propia dirección.';
    }
    actualizarEstadoWallet();
    FF.web3.on(actualizarEstadoWallet);

    document.getElementById('btn-depositar').addEventListener('click', async () => {
      const monto = Number(document.getElementById('in-deposito').value);
      const moneda = document.getElementById('in-moneda').value;
      if (!monto || monto <= 0) return ui.toast('Ingresa un monto válido', 'warn');
      const btn = document.getElementById('btn-depositar');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await api.depositar(monto);
        const s = FF.web3.estado();
        ui.toast(`Depositaste ${monto.toLocaleString('es-PE')} ${moneda} al pool${s.conectado ? ' desde ' + FF.web3.corto(s.address) : ' (wallet simulada de la demo)'}`);
        await refrescar();
      } finally {
        btn.disabled = false; btn.textContent = 'Depositar';
      }
    });

    document.getElementById('btn-retirar').addEventListener('click', async () => {
      const monto = Number(document.getElementById('in-deposito').value);
      const moneda = document.getElementById('in-moneda').value;
      if (!monto || monto <= 0) return ui.toast('Ingresa un monto válido', 'warn');
      const btn = document.getElementById('btn-retirar');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await api.retirar(monto);
        ui.toast(`Retiraste ${monto.toLocaleString('es-PE')} ${moneda} del pool`);
        await refrescar();
      } catch (err) {
        ui.toast(err.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'Retirar';
      }
    });

    document.getElementById('btn-fondos-prueba').addEventListener('click', async () => {
      const btn = document.getElementById('btn-fondos-prueba');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await api.depositar(10000);
        ui.toast('Cargaste 10,000 USDC de prueba al pool');
        await refrescar();
      } finally {
        btn.disabled = false; btn.textContent = '+ Cargar 10,000 USDC de prueba';
      }
    });
  }

  // -------------------- Calculadora: ¿cuánto ganarías tú? --------------------
  // Mismo motor que la calculadora de la PYME (pricing.calcularTasa) — el
  // retorno del prestamista es tasaFinal/(1-tasaFinal) sobre lo depositado.
  function bindCalculadoraRetorno() {
    const $ = (id) => document.getElementById(id);
    const inMonto = $('rin-monto'), inDias = $('rin-dias'), inUtil = $('rin-util');
    if (!inMonto) return null;

    function composicionPromedio() {
      if (!facturasActuales.length) return { score: 5, riesgo: 'medio' };
      const scoreProm = facturasActuales.reduce((s, f) => s + f.scoreAlEmitir, 0) / facturasActuales.length;
      return { score: Math.round(scoreProm), riesgo: 'medio' };
    }

    function render() {
      const monto = Number(inMonto.value);
      const dias = Number(inDias.value);
      const util = Number(inUtil.value) / 100;
      const { score, riesgo } = composicionPromedio();

      $('rv-monto').textContent = ui.usdc(monto);
      $('rv-dias').textContent = dias + ' días';
      $('rv-util').textContent = Math.round(util * 100) + '%';

      const t = pricing.calcularTasa({ dias, riesgoDeudor: riesgo, score, utilizacionPool: util });
      const retornoPct = t.tasaFinal / (1 - t.tasaFinal);
      const ganancia = monto * retornoPct;
      const apy = retornoPct * (365 / dias);

      $('rv-ganancia').textContent = ui.usdc(Math.round(ganancia));
      $('rv-ganancia-sub').textContent = `sobre ${ui.usdc(monto)} depositados, en ${dias} días`;
      $('rv-retorno-periodo').textContent = ui.pct(retornoPct, 2);
      $('rv-apy').textContent = ui.pct(apy, 1);
      $('rv-total').textContent = ui.usdc(Math.round(monto + ganancia));
    }

    [inMonto, inDias, inUtil].forEach((el) => el.addEventListener('input', render));
    render();
    return render;
  }

  // -------------------- Modal: Mi perfil (inversionista) --------------------
  let fotoPendienteInv; // undefined = sin cambios, null = quitar, dataURL = nueva foto

  function bindModalPerfilInv() {
    document.getElementById('btn-perfil-inv').addEventListener('click', abrirPerfilInv);

    const fotoInput = document.getElementById('pi-foto-input');
    document.getElementById('btn-pi-subir-foto').addEventListener('click', () => fotoInput.click());
    fotoInput.addEventListener('change', async () => {
      const file = fotoInput.files[0];
      if (!file) return;
      try {
        fotoPendienteInv = await redimensionarImagen(file, 220);
        pintarFotoPreviewInv(fotoPendienteInv);
      } catch (err) {
        ui.toast(err.message || 'No se pudo procesar la imagen', 'error');
      }
    });
    document.getElementById('btn-pi-quitar-foto').addEventListener('click', () => {
      fotoPendienteInv = null;
      pintarFotoPreviewInv(null);
    });

    document.getElementById('btn-guardar-perfil-inv').addEventListener('click', guardarPerfilInv);

    document.getElementById('btn-pi-usar-wallet').addEventListener('click', async () => {
      const s = FF.web3.estado();
      if (!s.conectado) { ui.toast('Conecta tu wallet primero con el botón de arriba', 'warn'); return; }
      try {
        inversionista = await api.actualizarPerfilInversionista({ wallet: s.address });
        renderIdentidadInversionista(inversionista);
        ui.toast('Wallet actualizada — ahora firma tus compras con esta dirección');
      } catch (err) {
        ui.toast(err.message || 'No se pudo actualizar la wallet', 'error');
      }
    });
  }

  function pintarFotoPreviewInv(dataUrlOrNull) {
    const preview = document.getElementById('pi-foto-preview');
    preview.innerHTML = dataUrlOrNull ? `<img src="${dataUrlOrNull}" alt="">` : `<span>${ui.initials(inversionista.nombre)}</span>`;
  }

  async function abrirPerfilInv() {
    fotoPendienteInv = undefined;
    document.getElementById('pi-nombre').textContent = inversionista.nombre;
    document.getElementById('pi-fecha').innerHTML = ui.fecha(inversionista.createdAt);
    document.getElementById('pi-saldo').textContent = ui.usdc(inversionista.saldoUSDC);
    document.getElementById('pi-email').value = inversionista.email || '';
    document.getElementById('pi-telefono').value = inversionista.telefono || '';
    pintarFotoPreviewInv(inversionista.foto || null);

    const posiciones = await api.getPosicionesInversionista();
    const invertidoTotal = posiciones.reduce((s, p) => s + p.montoInvertido, 0);
    document.getElementById('pi-invertido').textContent = ui.usdc(invertidoTotal);
    renderPosicionesInv(posiciones);

    if (FF.web3ui && !window.__perfilInvWalletMontado) {
      window.__perfilInvWalletMontado = true;
      FF.web3ui.mount('pi-wallet-slot');
      FF.web3.on((s) => {
        document.getElementById('pi-wallet-estado').textContent = s.conectado
          ? `Conectada: ${FF.web3.corto(s.address)}`
          : 'No conectada — usando la wallet del perfil';
      });
    }

    ui.openModal('modal-perfil-inv');
  }

  function renderPosicionesInv(posiciones) {
    const cont = document.getElementById('pi-posiciones');
    if (!posiciones.length) {
      cont.innerHTML = '<p class="faint" style="font-size:.82rem;">Todavía no compraste ninguna opción — ciérrame y elige una factura en "Contratos tokenizados".</p>';
      return;
    }
    cont.innerHTML = posiciones.slice().reverse().map((p) => {
      const f = p.factura;
      if (!f) return '';
      return `
        <div class="account-row" style="margin-bottom:10px;">
          <div>
            <div class="cell-strong" style="font-size:.85rem;">${f.deudor}</div>
            <div class="faint" style="font-size:.78rem;">${ui.usdc(p.montoInvertido)} invertidos · ${ui.fecha(p.fecha)}</div>
          </div>
          <button class="btn btn-outline btn-sm" data-ver-contrato-inv="${f.id}" data-monto="${p.montoInvertido}">Ver contrato</button>
        </div>`;
    }).join('');

    cont.querySelectorAll('[data-ver-contrato-inv]').forEach((btn) => {
      btn.addEventListener('click', () => abrirContratoInv(btn.dataset.verContratoInv, Number(btn.dataset.monto)));
    });
  }

  async function guardarPerfilInv() {
    const email = document.getElementById('pi-email');
    const telefono = document.getElementById('pi-telefono');
    if (!email.checkValidity() || !email.value.trim() || !telefono.checkValidity() || !telefono.value.trim()) {
      ui.toast('Correo y teléfono son obligatorios — revisa el formato', 'warn');
      return;
    }
    const btn = document.getElementById('btn-guardar-perfil-inv');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Guardando…';
    try {
      const cambios = {
        email: email.value.trim(),
        telefono: telefono.value.trim(),
      };
      if (fotoPendienteInv !== undefined) cambios.foto = fotoPendienteInv;
      inversionista = await api.actualizarPerfilInversionista(cambios);
      renderIdentidadInversionista(inversionista);
      ui.toast('Perfil actualizado ✓');
      ui.closeModal('modal-perfil-inv');
    } catch (err) {
      ui.toast(err.message || 'No se pudo guardar el perfil', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
    }
  }

  // Redimensiona la imagen en el navegador antes de guardarla — evita
  // llenar el localStorage con fotos de varios MB tomadas del celular.
  function redimensionarImagen(file, maxLado) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) { reject(new Error('El archivo debe ser una imagen')); return; }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Imagen no válida'));
        img.onload = () => {
          const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
          const w = Math.round(img.width * escala);
          const h = Math.round(img.height * escala);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // -------------------- Marketplace: comprar opción + contrato --------------------
  let facturaEnCompra = null;

  function bindModalesMarketplace() {
    document.getElementById('btn-confirmar-compra').addEventListener('click', confirmarCompra);
    document.getElementById('btn-imprimir-contrato-inv').addEventListener('click', () => window.print());
    document.getElementById('btn-limpiar-firma-inv').addEventListener('click', limpiarFirmaInv);
  }

  function abrirComprar(facturaId) {
    const f = facturasActuales.find((x) => x.id === facturaId);
    if (!f || !f.pricing) return;
    facturaEnCompra = f;
    document.getElementById('comprar-resumen').innerHTML = `
      <div class="row"><span class="k">Deudor</span><span class="v">${f.deudor}</span></div>
      <div class="row"><span class="k">Monto de la factura</span><span class="v">${ui.soles(f.monto)}</span></div>
      <div class="row"><span class="k">Plazo</span><span class="v">${f.dias} días</span></div>
      <div class="row"><span class="k">Tasa aplicada</span><span class="v">${ui.pct(f.pricing.tasaFinal, 2)}</span></div>
      <div class="row total"><span class="k">Retorno estimado del prestamista</span><span class="v emerald">${ui.pct(f.pricing.retornoPct, 2)}</span></div>
    ` + repartoHTML(f.pricing);
    document.getElementById('comprar-monto').value = Math.max(1, Math.min(1000, Math.round(f.pricing.precioDescontado)));
    document.getElementById('comprar-saldo-disp').textContent = ui.usdc(inversionista.saldoUSDC);
    ui.openModal('modal-comprar');
  }

  // Visual de "todos ganan": de cada S/ de la factura, quién se lleva qué.
  // brutoPyme + descuentoTotal + fee = monto, exacto.
  function repartoHTML(op) {
    const pymeShare = op.brutoPyme, prestamistaShare = op.descuentoTotal, facturafiShare = op.fee;
    const pct = (v) => (v / op.monto) * 100;
    return `
      <div class="divider" style="margin:14px 0;"></div>
      <div class="faint" style="font-size:.72rem; text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px;">Así se reparte esta operación — todos ganan</div>
      <div class="composicion-bar" style="margin-bottom:8px;">
        <span style="width:${pct(pymeShare)}%; background:var(--gold);"></span>
        <span style="width:${pct(prestamistaShare)}%; background:var(--emerald);"></span>
        <span style="width:${pct(facturafiShare)}%; background:var(--stone);"></span>
      </div>
      <div class="composicion-legend">
        <span class="item"><span class="dot" style="background:var(--gold);"></span>La PYME: ${ui.soles(pymeShare)}</span>
        <span class="item"><span class="dot" style="background:var(--emerald);"></span>Tú (prestamista): ${ui.soles(prestamistaShare)}</span>
        <span class="item"><span class="dot" style="background:var(--stone);"></span>FacturaFi: ${ui.soles(facturafiShare)}</span>
      </div>
    `;
  }

  async function confirmarCompra() {
    if (!facturaEnCompra) return;
    const monto = Number(document.getElementById('comprar-monto').value);
    const moneda = document.getElementById('comprar-moneda').value;
    if (!monto || monto <= 0) { ui.toast('Ingresa un monto válido', 'warn'); return; }

    const btn = document.getElementById('btn-confirmar-compra');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      inversionista = await api.comprarOpcion(facturaEnCompra.id, monto);
      renderIdentidadInversionista(inversionista);
      ui.toast(`¡Gracias por tu compra! Depositaste ${monto.toLocaleString('es-PE')} ${moneda} a la factura de ${facturaEnCompra.deudor} — aquí está tu contrato`);
      ui.closeModal('modal-comprar');
      await abrirContratoInv(facturaEnCompra.id, monto);
    } catch (err) {
      ui.toast(err.message || 'No se pudo completar la compra', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Aceptar y depositar a la PYME';
    }
  }

  // Reabre el contrato de una factura "pendiente a pago" desde la tabla del
  // pool. Si el prestamista ya invirtió en ella, muestra su posición y su
  // firma; si todavía no, muestra una vista previa (reglas, términos y
  // firma del responsable legal) sin monto ni firma propia.
  async function abrirContratoDesdePool(facturaId) {
    const posiciones = await api.getPosicionesInversionista();
    const propia = posiciones.find((p) => p.factura && p.factura.id === facturaId);
    await abrirContratoInv(facturaId, propia ? propia.montoInvertido : null);
  }

  async function abrirContratoInv(facturaId, montoInvertido) {
    const f = await api.getFactura(facturaId);
    if (!f || !f.sc) return;
    document.getElementById('contract-doc-inv').innerHTML = renderContratoInv(f, inversionista, montoInvertido);
    document.getElementById('btn-limpiar-firma-inv').style.display = montoInvertido != null ? '' : 'none';
    ui.closeModal('modal-perfil-inv');
    ui.closeModal('modal-comprar');
    ui.openModal('modal-contrato-inv');
    if (montoInvertido != null) setTimeout(iniciarFirmaCanvasInv, 60);
  }

  // "Firma" fija del responsable legal de FacturaFi — dato ficticio de demo,
  // igual que el resto de identidades de ejemplo en esta app (EMPRESAS_DEMO).
  const RESPONSABLE_LEGAL_FACTURAFI = 'Fernanda Ríos Salazar';

  function renderContratoInv(f, inv, monto) {
    const op = f.pricing;
    const walletCorta = ui.corto(inv.wallet, 14);
    const invertidoYa = monto != null;
    return `
      <div class="contract-head">
        <img src="assets/mascota-facturafi.jpg" class="contract-logo" alt="FacturaFi">
        <div>
          <h2>FacturaFi</h2>
          <p class="muted mb-0">Contrato de Adquisición de Derecho de Cobro (Opción tokenizada)</p>
        </div>
        <div class="contract-id">N° ${f.id.split('_')[1].toUpperCase()}<br>${f.tokenId || 'sin token'}</div>
      </div>

      <p class="muted" style="margin:-4px 0 24px;">Estimado/a ${inv.nombre}, agradecemos su confianza. Por ello, le hacemos llegar el siguiente contrato legal:</p>

      <div class="contract-section">
        <h4>I. Partes</h4>
        <div class="contract-grid">
          <div><span class="k">Adquirente (prestamista)</span><span class="v">${inv.nombre}</span></div>
          <div><span class="k">Contacto</span><span class="v">${inv.email || '—'}${inv.telefono ? ' · ' + inv.telefono : ''}</span></div>
          <div><span class="k">Wallet adquirente</span><span class="v mono">${walletCorta}</span></div>
          <div><span class="k">Deudor (pagador original)</span><span class="v">${f.deudor}</span></div>
        </div>
      </div>

      <div class="contract-section">
        <h4>II. Términos de la opción adquirida</h4>
        <div class="contract-grid">
          <div><span class="k">Monto invertido</span><span class="v">${invertidoYa ? ui.usdc(monto) : 'Pendiente de confirmar'}</span></div>
          <div><span class="k">Monto total de la factura</span><span class="v">${ui.soles(f.monto)}</span></div>
          <div><span class="k">Plazo</span><span class="v">${f.dias} días</span></div>
          <div><span class="k">Fecha de vencimiento</span><span class="v">${f.fechaVencimiento ? new Date(f.fechaVencimiento).toLocaleDateString('es-PE') : '—'}</span></div>
          <div><span class="k">Tasa aplicada (%_extra)</span><span class="v">${op ? ui.pct(op.tasaFinal, 2) : '—'}</span></div>
          <div><span class="k">Retorno estimado</span><span class="v">${op ? ui.pct(op.retornoPct, 2) : '—'}</span></div>
          <div><span class="k">Estado actual de la factura</span><span class="v">${ui.badgeEstado(f.estado)}</span></div>
        </div>
      </div>

      <div class="contract-section">
        <h4>III. Reglas y normas</h4>
        <ul class="contract-rules">
          <li>El monto invertido se transfiere a la PYME en cuanto se confirma esta operación.</li>
          <li>El retorno pactado se reparte al prestamista cuando el deudor paga la factura, o al vencimiento del plazo indicado arriba.</li>
          <li>Si el pago se atrasa, la retención parcial (Capa 2) amortigua la pérdida y el score on-chain de la PYME (Capa 3) se penaliza.</li>
          <li>Si la factura cae en default, el Fondo de Garantía de FacturaFi (Capa 4) cubre la pérdida del prestamista.</li>
          <li>Esta operación se rige por la Ley N° 29623, que promueve el financiamiento a través de la factura comercial.</li>
          <li>El Adquirente participa como prestamista del pool de FacturaFi y adquiere el derecho proporcional sobre el retorno de esta factura negociable.</li>
          <li>Esta es una simulación de demo de hackathon — no representa una inversión real ni una relación contractual vinculante.</li>
        </ul>
      </div>

      <div class="contract-section contract-firma">
        <h4>IV. Firmas</h4>
        ${invertidoYa ? `
          <p class="muted">Yo, ${inv.nombre}, acepto adquirir el derecho sobre el retorno de esta operación bajo los términos aquí descritos.</p>
          <canvas id="firma-canvas-inv" width="480" height="140"></canvas>
          <div class="contract-firma-meta">
            <span>Firma digital (wallet): <span class="mono">${walletCorta}</span></span>
            <span>Fecha: ${new Date().toLocaleString('es-PE')}</span>
          </div>
        ` : `
          <p class="muted">Vista previa del contrato — tu firma y el monto invertido quedan registrados al confirmar la compra de esta opción.</p>
        `}
        <div class="contract-firma-legal">
          <img src="assets/firma-responsable-legal.png" alt="Firma del responsable legal de FacturaFi" class="contract-firma-img">
          <div class="contract-firma-meta">
            <span>${RESPONSABLE_LEGAL_FACTURAFI} — Responsable legal de FacturaFi</span>
            <span>Fecha: ${new Date().toLocaleDateString('es-PE')}</span>
          </div>
        </div>
      </div>

      <p class="muted text-center" style="margin-top:18px; font-size:.82rem;">${invertidoYa ? 'Gracias por tu compra — tu depósito ya está a favor de la PYME.' : 'Gracias por tu confianza en FacturaFi.'}</p>
    `;
  }

  let firmaCanvasInv, firmaCtxInv, firmandoInv = false;

  function iniciarFirmaCanvasInv() {
    firmaCanvasInv = document.getElementById('firma-canvas-inv');
    if (!firmaCanvasInv) return;
    firmaCtxInv = firmaCanvasInv.getContext('2d');
    firmaCtxInv.strokeStyle = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#14120f';
    firmaCtxInv.lineWidth = 2.2;
    firmaCtxInv.lineCap = 'round';

    const posicion = (e) => {
      const r = firmaCanvasInv.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return { x: (p.clientX - r.left) * (firmaCanvasInv.width / r.width), y: (p.clientY - r.top) * (firmaCanvasInv.height / r.height) };
    };
    const empezar = (e) => { firmandoInv = true; const p = posicion(e); firmaCtxInv.beginPath(); firmaCtxInv.moveTo(p.x, p.y); e.preventDefault(); };
    const mover = (e) => { if (!firmandoInv) return; const p = posicion(e); firmaCtxInv.lineTo(p.x, p.y); firmaCtxInv.stroke(); e.preventDefault(); };
    const terminar = () => { firmandoInv = false; };

    firmaCanvasInv.addEventListener('mousedown', empezar);
    firmaCanvasInv.addEventListener('mousemove', mover);
    window.addEventListener('mouseup', terminar);
    firmaCanvasInv.addEventListener('touchstart', empezar, { passive: false });
    firmaCanvasInv.addEventListener('touchmove', mover, { passive: false });
    firmaCanvasInv.addEventListener('touchend', terminar);
  }

  function limpiarFirmaInv() {
    if (!firmaCtxInv || !firmaCanvasInv) return;
    firmaCtxInv.clearRect(0, 0, firmaCanvasInv.width, firmaCanvasInv.height);
  }

  // -------------------- Ranking de PYMEs --------------------
  // Empresas de ejemplo, solo para que el ranking se vea poblado en la demo
  // (claramente marcadas como "Ejemplo" en la UI, sin datos de contacto
  // inventados). Se combinan con la PYME real registrada en este navegador,
  // si existe — esa fila usa sus datos reales y sí permite contactarla.
  const ICON_STAR = '<svg width="13" height="13" viewBox="0 0 24 24" fill="var(--gold)" stroke="var(--gold-ink)" stroke-width="1" stroke-linejoin="round"><polygon points="12 2 15 9 22 9.5 16.5 14.5 18.5 22 12 17.5 5.5 22 7.5 14.5 2 9.5 9 9"/></svg>';
  const EMPRESAS_DEMO = [
    { nombre: 'Ferretería San Martín E.I.R.L.', rubro: 'Ferretería / materiales de construcción', score: 9, operaciones: 14, liquidez: 128400, tiposFinanciamiento: ['Venta de facturas', 'Inversión de capital (equity)', 'Alianza comercial / distribución'] },
    { nombre: 'Comercial Andina S.A.C.', rubro: 'Distribución / mayorista', score: 7, operaciones: 9, liquidez: 76200, buscaInversion: true, montoBuscado: 30000, tiposFinanciamiento: ['Venta de facturas', 'Préstamo directo a plazo'] },
    { nombre: 'Textiles del Sur E.I.R.L.', rubro: 'Textil / confecciones', score: 6, operaciones: 6, liquidez: 41800, tiposFinanciamiento: ['Venta de facturas'] },
    { nombre: 'Alimentos Andinos S.A.C.', rubro: 'Alimentos y bebidas', score: 5, operaciones: 5, liquidez: 33500, buscaInversion: true, montoBuscado: 15000, tiposFinanciamiento: ['Venta de facturas', 'Inversión de capital (equity)'] },
    { nombre: 'Consultores del Pacífico S.A.C.', rubro: 'Servicios profesionales', score: 4, operaciones: 3, liquidez: 18900 },
    { nombre: 'Distribuidora Norteña E.I.R.L.', rubro: 'Distribución / mayorista', score: 2, operaciones: 1, liquidez: 6200 },
  ];

  function construirRanking() {
    const empresas = EMPRESAS_DEMO.map((e) => ({ ...e, esDemo: true }));
    const pyme = FF.db.getPyme();
    if (pyme) {
      empresas.push({
        nombre: pyme.nombre, rubro: pyme.rubro, score: pyme.score,
        operaciones: pyme.operacionesTotales || 0, liquidez: pyme.liquidezRecibidaTotal || 0,
        esDemo: false, pitch: pyme.pitch, email: pyme.email, telefono: pyme.telefono,
        buscaInversion: Boolean(pyme.buscaInversion), montoBuscado: pyme.montoBuscado || 0,
        tiposFinanciamiento: pyme.tiposFinanciamiento || [],
      });
    }
    // Las que buscan inversores activamente suben primero — así se destacan
    // ("atento") ante el prestamista antes de mirar el resto del ranking.
    return empresas.sort((a, b) =>
      (b.buscaInversion ? 1 : 0) - (a.buscaInversion ? 1 : 0) || b.score - a.score || b.operaciones - a.operaciones
    );
  }

  function renderRanking() {
    const tbody = document.getElementById('tabla-ranking');
    if (!tbody) return;
    const ranking = construirRanking();

    tbody.innerHTML = ranking.map((e, i) => `
      <tr style="${!e.esDemo ? 'background:var(--surface-2);' : ''}">
        <td class="cell-strong">${i === 0 ? ICON_STAR + ' ' : ''}${i + 1}</td>
        <td>
          <div class="cell-strong">${e.nombre}${!e.esDemo ? ' <span class="badge" style="background:var(--gold); color:var(--text); margin-left:6px;">Tú</span>' : ''}</div>
          <div class="flex gap-8" style="margin-top:3px;">
            ${e.esDemo ? '<div class="faint" style="font-size:.72rem;">Ejemplo ilustrativo</div>' : ''}
            ${e.buscaInversion ? '<span class="badge" style="background:var(--emerald); color:#fff;">Buscando inversores</span>' : ''}
          </div>
        </td>
        <td class="muted" style="font-size:.82rem;">${e.rubro || '—'}</td>
        <td><span style="color:${ui.scoreColor(e.score)}; font-weight:700;">${e.score} / 10</span></td>
        <td>${e.operaciones}</td>
        <td>${ui.soles(e.liquidez)}</td>
        <td><button class="btn btn-ghost btn-sm" data-ver-rank="${i}">Ver perfil</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-ver-rank]').forEach((btn) => {
      btn.addEventListener('click', () => abrirPerfilRanking(ranking[Number(btn.dataset.verRank)]));
    });
  }

  function abrirPerfilRanking(e) {
    document.getElementById('rank-nombre').textContent = e.nombre;
    document.getElementById('rank-datos').innerHTML = `
      <div><span class="k">Rubro</span><span class="v">${e.rubro || '—'}</span></div>
      <div><span class="k">Score on-chain</span><span class="v" style="color:${ui.scoreColor(e.score)};">${e.score} / 10 · ${ui.scoreLabel(e.score)}</span></div>
      <div><span class="k">Operaciones pagadas</span><span class="v">${e.operaciones}</span></div>
      <div><span class="k">Liquidez movilizada</span><span class="v">${ui.soles(e.liquidez)}</span></div>
    `;

    document.getElementById('rank-pitch').textContent = e.pitch && e.pitch.trim()
      ? e.pitch.trim()
      : (e.esDemo
        ? 'Esta es una empresa de ejemplo, incluida solo para ilustrar cómo se ve el ranking — no representa un negocio real.'
        : 'Esta empresa todavía no agregó una descripción de su negocio en su perfil.');

    const wrap = document.getElementById('rank-contacto-wrap');
    const bloqueMonto = e.buscaInversion ? `
      <div class="divider"></div>
      <div class="receipt" style="margin-top:0;">
        <div class="row total"><span class="k">Buscando inversores — monto a negociar</span><span class="v emerald">${ui.soles(e.montoBuscado || 0)}</span></div>
      </div>` : '';

    // Con score 4+ (riesgo medio o bajo) la empresa desbloquea visibilidad
    // para otros tipos de financiamiento, más allá de la venta de facturas.
    let bloqueTipos = '';
    if (e.score >= 4 && e.tiposFinanciamiento && e.tiposFinanciamiento.length) {
      bloqueTipos = `
        <div class="divider"></div>
        <h4 style="margin-bottom:8px;">Tipos de financiamiento que busca</h4>
        <div class="flex gap-8" style="flex-wrap:wrap;">
          ${e.tiposFinanciamiento.map((t) => `<span class="fin-chip" style="cursor:default;">${t}</span>`).join('')}
        </div>`;
    } else if (e.score < 4) {
      bloqueTipos = `
        <div class="divider"></div>
        <p class="faint" style="font-size:.78rem;">Con score 4+ esta empresa desbloquea visibilidad para otros tipos de financiamiento además de la venta de facturas.</p>`;
    }

    if (e.esDemo) {
      wrap.innerHTML = `${bloqueMonto}${bloqueTipos}<div class="divider"></div><div class="hint">Empresa de ejemplo — no tiene datos de contacto reales.</div>`;
    } else {
      const acciones = [];
      if (e.email) acciones.push(`<a class="btn btn-outline btn-sm" href="mailto:${e.email}">Escribir correo</a>`);
      if (e.telefono) acciones.push(`<a class="btn btn-primary btn-sm" target="_blank" rel="noopener" href="https://wa.me/${e.telefono.replace(/[^0-9]/g, '')}">Escribir por WhatsApp</a>`);
      wrap.innerHTML = `
        ${bloqueMonto}${bloqueTipos}
        <div class="divider"></div>
        <h4 style="margin-bottom:10px;">Contacto directo — para negociar los términos internamente</h4>
        <div class="profile-readonly" style="margin-bottom:12px;">
          <div><span class="k">Correo</span><span class="v">${e.email || '—'}</span></div>
          <div><span class="k">Teléfono</span><span class="v mono">${e.telefono || '—'}</span></div>
        </div>
        ${acciones.length ? `<div class="flex gap-8" style="flex-wrap:wrap;">${acciones.join('')}</div>` : '<p class="faint" style="font-size:.82rem;">Esta empresa todavía no agregó datos de contacto.</p>'}
      `;
    }

    ui.openModal('modal-perfil-rank');
  }
})();
