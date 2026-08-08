/* ============================================================
   FacturaFi — dashboard.js
   Panel de la PYME: KPIs, tabla de facturas, alta + tokenización,
   y las acciones que recorren el ciclo de vida completo
   (Documento-Producto-Extenso §10: Rama A pago a tiempo / Rama B atraso).
   ============================================================ */

(function () {
  const { ui, api } = FF;
  let pyme = null;
  // El riesgo del deudor ya no se pide por separado — el score de la PYME
  // alcanza para mostrar cómo cambia la tasa. Queda fijo en "medio" (neutral).
  const riesgoSeleccionado = 'medio';

  const ICON_LINK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
  const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const ICON_DOC = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h8l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M15 3v4h4"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>';

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    pyme = await ui.requirePyme();
    if (!pyme) return;

    renderIdentity(pyme);
    bindGlobalActions();
    bindModalNuevaFactura();
    bindModalPerfil();
    bindModalContrato();
    await refrescar();
  }

  function renderIdentity(p) {
    const avatarEl = document.getElementById('avatar');
    avatarEl.innerHTML = p.foto ? `<img src="${p.foto}" alt="">` : ui.initials(p.nombre);
    document.getElementById('pyme-nombre').textContent = p.nombre;
    document.getElementById('pyme-sub').textContent = `RUC ${p.ruc} · ${ui.corto(p.wallet, 10)}`;
  }

  // -------------------- Modal: Mi Perfil --------------------
  let fotoPendiente; // undefined = sin cambios, null = quitar, dataURL = nueva foto

  function bindModalPerfil() {
    document.getElementById('btn-perfil').addEventListener('click', abrirPerfil);

    const fotoInput = document.getElementById('perfil-foto-input');
    document.getElementById('btn-subir-foto').addEventListener('click', () => fotoInput.click());
    fotoInput.addEventListener('change', async () => {
      const file = fotoInput.files[0];
      if (!file) return;
      try {
        fotoPendiente = await redimensionarImagen(file, 220);
        pintarFotoPreview(fotoPendiente);
      } catch (err) {
        ui.toast(err.message || 'No se pudo procesar la imagen', 'error');
      }
    });
    document.getElementById('btn-quitar-foto').addEventListener('click', () => {
      fotoPendiente = null;
      pintarFotoPreview(null);
    });

    document.getElementById('btn-guardar-perfil').addEventListener('click', guardarPerfil);

    document.getElementById('btn-usar-wallet-conectada').addEventListener('click', async () => {
      const s = FF.web3.estado();
      if (!s.conectado) { ui.toast('Conecta tu wallet primero con el botón de arriba', 'warn'); return; }
      try {
        pyme = await api.actualizarPerfil({ wallet: s.address });
        document.getElementById('perfil-wallet').value = pyme.wallet;
        document.getElementById('pyme-sub').textContent = `RUC ${pyme.ruc} · ${ui.corto(pyme.wallet, 10)}`;
        ui.toast('Wallet actualizada — ahora firma tus operaciones con esta dirección');
      } catch (err) {
        ui.toast(err.message || 'No se pudo actualizar la wallet', 'error');
      }
    });
  }

  function pintarFotoPreview(dataUrlOrNull) {
    const preview = document.getElementById('perfil-foto-preview');
    preview.innerHTML = dataUrlOrNull ? `<img src="${dataUrlOrNull}" alt="">` : `<span>${ui.initials(pyme.nombre)}</span>`;
  }

  async function abrirPerfil() {
    fotoPendiente = undefined;
    document.getElementById('perfil-nombre').textContent = pyme.nombre;
    document.getElementById('perfil-ruc').textContent = pyme.ruc;
    document.getElementById('perfil-rubro').textContent = pyme.rubro;
    document.getElementById('perfil-fecha').innerHTML = ui.fecha(pyme.createdAt);
    document.getElementById('perfil-email').value = pyme.email || '';
    document.getElementById('perfil-telefono').value = pyme.telefono || '';
    document.getElementById('perfil-web').value = pyme.sitioWeb || '';
    document.getElementById('perfil-wallet').value = pyme.wallet || '';
    document.getElementById('perfil-pitch').value = pyme.pitch || '';
    document.getElementById('perfil-busca-inversion').checked = Boolean(pyme.buscaInversion);
    document.getElementById('perfil-monto-buscado').value = pyme.montoBuscado || '';
    const tiposGuardados = pyme.tiposFinanciamiento || [];
    document.querySelectorAll('#fin-tipos input[type=checkbox]').forEach((cb) => {
      cb.checked = tiposGuardados.includes(cb.value);
    });
    document.getElementById('perfil-gauge').innerHTML = ui.gaugeHTML(pyme.score, pyme.scoreMax);
    pintarFotoPreview(pyme.foto || null);

    const facturas = await api.getFacturas();
    document.getElementById('perfil-ops').textContent = facturas.filter((f) => f.estado === 'pagada').length;
    document.getElementById('perfil-liquidez').textContent = ui.soles(pyme.liquidezRecibidaTotal);
    document.getElementById('perfil-activas').textContent = facturas.filter((f) => ['pendiente', 'financiada', 'en_mora'].includes(f.estado)).length;

    if (FF.web3ui && !window.__perfilWalletMontado) {
      window.__perfilWalletMontado = true;
      FF.web3ui.mount('perfil-wallet-slot');
      FF.web3.on((s) => {
        document.getElementById('perfil-wallet-estado').textContent = s.conectado
          ? `Conectada: ${FF.web3.corto(s.address)}`
          : 'No conectada — usando la wallet del perfil';
      });
    }

    ui.openModal('modal-perfil');
  }

  async function guardarPerfil() {
    const email = document.getElementById('perfil-email');
    const telefono = document.getElementById('perfil-telefono');
    if (!email.checkValidity() || !email.value.trim() || !telefono.checkValidity() || !telefono.value.trim()) {
      ui.toast('Correo y teléfono son obligatorios — revisa el formato', 'warn');
      return;
    }
    const btn = document.getElementById('btn-guardar-perfil');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Guardando…';
    try {
      const cambios = {
        email: email.value.trim(),
        telefono: telefono.value.trim(),
        sitioWeb: document.getElementById('perfil-web').value.trim(),
        pitch: document.getElementById('perfil-pitch').value.trim(),
        buscaInversion: document.getElementById('perfil-busca-inversion').checked,
        montoBuscado: Number(document.getElementById('perfil-monto-buscado').value) || 0,
        tiposFinanciamiento: Array.from(document.querySelectorAll('#fin-tipos input[type=checkbox]:checked')).map((cb) => cb.value),
      };
      if (fotoPendiente !== undefined) cambios.foto = fotoPendiente;
      pyme = await api.actualizarPerfil(cambios);
      renderIdentity(pyme);
      ui.toast('Perfil actualizado ✓');
      ui.closeModal('modal-perfil');
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

  async function refrescar() {
    pyme = await api.getPyme();
    const facturas = await api.getFacturas();
    renderKpis(pyme, facturas);
    renderTabla(facturas);
  }

  function renderKpis(p, facturas) {
    document.getElementById('kpi-score').innerHTML = ui.gaugeHTML(p.score, p.scoreMax);
    document.getElementById('kpi-liquidez').textContent = ui.soles(p.liquidezRecibidaTotal);
    const activas = facturas.filter((f) => ['pendiente', 'financiada', 'en_mora'].includes(f.estado)).length;
    document.getElementById('kpi-activas').textContent = activas;
    document.getElementById('kpi-ops').textContent = facturas.filter((f) => f.estado === 'pagada').length;
  }

  function renderTabla(facturas) {
    const tbody = document.getElementById('tabla-facturas');
    const empty = document.getElementById('empty-state');
    document.getElementById('facturas-count').textContent = `${facturas.length} factura${facturas.length === 1 ? '' : 's'}`;

    if (!facturas.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = facturas.map((f) => `
      <tr>
        <td>
          <div class="cell-strong">#${f.id.split('_')[1]}</div>
          <div class="cell-mono">${f.tokenId ? ui.corto(f.tokenId, 14) : 'sin tokenizar'}</div>
        </td>
        <td class="muted" style="font-size:.82rem;">${f.deudor}</td>
        <td class="cell-strong">${ui.soles(f.monto)}</td>
        <td>${f.dias} días</td>
        <td>${ui.badgeEstado(f.estado)}</td>
        <td class="cell-mono">${f.pricing ? ui.pct(f.pricing.tasaFinal, 1) : '—'}</td>
        <td class="cell-mono">${f.pricing ? ui.soles(f.pricing.liberadoInicial) : '—'}</td>
        <td><button class="btn btn-ghost btn-sm" data-open-detalle="${f.id}">Ver</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-open-detalle]').forEach((btn) => {
      btn.addEventListener('click', () => abrirDetalle(btn.dataset.openDetalle));
    });
  }

  // -------------------- Modal: nueva factura --------------------
  // El plazo se calcula solo, a partir de una fecha de vencimiento elegida
  // en el calendario — nada de contar días/semanas/meses a mano.
  function fechaISO(d) { return d.toISOString().slice(0, 10); }

  function obtenerDiasTotal() {
    const valor = document.getElementById('f-vencimiento').value;
    if (!valor) { document.getElementById('f-dias-total').textContent = '0'; return 0; }
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const venc = new Date(valor + 'T00:00:00');
    const total = Math.max(1, Math.round((venc - hoy) / 86400000));
    document.getElementById('f-dias-total').textContent = total;
    return total;
  }

  function bindModalNuevaFactura() {
    const abrir = () => {
      document.getElementById('form-factura').reset();
      document.getElementById('f-monto').value = 10000;
      document.getElementById('f-moneda').value = 'PEN';
      const hoy = new Date();
      const manana = new Date(hoy.getTime() + 86400000);
      const vencDefault = new Date(hoy.getTime() + 60 * 86400000);
      const vencInput = document.getElementById('f-vencimiento');
      vencInput.min = fechaISO(manana);
      vencInput.value = fechaISO(vencDefault);
      obtenerDiasTotal();
      actualizarPreview();
      ui.openModal('modal-nueva');
    };
    document.getElementById('btn-nueva-factura').addEventListener('click', abrir);
    document.getElementById('btn-empty-nueva').addEventListener('click', abrir);

    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => ui.closeModal(btn.dataset.close));
    });

    const btnScoreAyudaFactura = document.getElementById('btn-score-ayuda-factura');
    if (btnScoreAyudaFactura) {
      btnScoreAyudaFactura.addEventListener('click', () => FF.assistant.preguntar('como-sube-score'));
    }

    ['f-monto', 'f-vencimiento'].forEach((id) => document.getElementById(id).addEventListener('input', actualizarPreview));

    document.getElementById('btn-crear-factura').addEventListener('click', crearFactura);
  }

  async function actualizarPreview() {
    const monto = Number(document.getElementById('f-monto').value) || 0;
    const dias = obtenerDiasTotal();
    const pool = await api.getPool();
    const op = FF.pricing.calcularOperacion({ monto, dias, riesgoDeudor: riesgoSeleccionado, score: pyme.score, utilizacionPool: pool.utilizacion });

    document.getElementById('preview-receipt').innerHTML = `
      <div class="row"><span class="k">Tasa final estimada</span><span class="v">${ui.pct(op.tasaFinal, 2)}</span></div>
      <div class="row"><span class="k">Fee de originación (1%)</span><span class="v">${ui.soles(op.fee)}</span></div>
      <div class="row"><span class="k">Retención (Capa 2, liberada al pagar)</span><span class="v">${ui.soles(op.retenido)}</span></div>
      <div class="row total"><span class="k">Recibirías hoy</span><span class="v gold">${ui.soles(op.liberadoInicial)}</span></div>
    ` + repartoHTML(op);
  }

  // Visual de "todos ganan": de cada S/ de tu factura, quién se lleva qué.
  // pymeShare + prestamistaShare + facturafiShare = monto, exacto.
  function repartoHTML(op) {
    const pymeShare = op.brutoPyme, prestamistaShare = op.descuentoTotal, facturafiShare = op.fee;
    const pct = (v) => (v / op.monto) * 100;
    return `
      <div class="divider" style="margin:14px 0;"></div>
      <div class="faint" style="font-size:.72rem; text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px;">Así se reparte tu factura — todos ganan</div>
      <div class="composicion-bar" style="margin-bottom:8px;">
        <span style="width:${pct(pymeShare)}%; background:var(--gold);"></span>
        <span style="width:${pct(prestamistaShare)}%; background:var(--emerald);"></span>
        <span style="width:${pct(facturafiShare)}%; background:var(--stone);"></span>
      </div>
      <div class="composicion-legend">
        <span class="item"><span class="dot" style="background:var(--gold);"></span>Tú (PYME): ${ui.soles(pymeShare)}</span>
        <span class="item"><span class="dot" style="background:var(--emerald);"></span>Prestamista: ${ui.soles(prestamistaShare)}</span>
        <span class="item"><span class="dot" style="background:var(--stone);"></span>FacturaFi: ${ui.soles(facturafiShare)}</span>
      </div>
    `;
  }

  async function crearFactura() {
    const btn = document.getElementById('btn-crear-factura');
    const deudor = document.getElementById('f-deudor').value.trim();
    const monto = Number(document.getElementById('f-monto').value);
    const dias = obtenerDiasTotal();
    if (!deudor || !monto || !dias) { ui.toast('Completa todos los campos', 'warn'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Registrando…';
    try {
      const factura = await api.crearFactura({ monto, deudor, riesgoDeudor: riesgoSeleccionado, dias });
      ui.closeModal('modal-nueva');
      ui.toast('Factura registrada. Ahora puedes tokenizarla y financiarla.');
      await refrescar();
      abrirDetalle(factura.id);
    } catch (err) {
      ui.toast(err.message || 'No se pudo registrar la factura', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Registrar factura';
    }
  }

  // -------------------- Modal: detalle / ciclo de vida --------------------
  async function abrirDetalle(id) {
    const f = await api.getFactura(id);
    if (!f) return;
    document.getElementById('det-titulo').textContent = `Factura · ${f.deudor}`;
    document.getElementById('det-body').innerHTML = renderDetalleBody(f);
    bindAccionesDetalle();
    ui.openModal('modal-detalle');
  }

  function renderDetalleBody(f) {
    const op = f.pricing;
    const receipt = op ? `
      <div class="receipt">
        <div class="row"><span class="k">Score de la PYME al emitir</span><span class="v">${f.scoreAlEmitir} / 10</span></div>
        <div class="row"><span class="k">Tasa final (%_extra del SC)</span><span class="v">${ui.pct(op.tasaFinal, 2)}</span></div>
        <div class="row"><span class="k">Precio pagado por el pool</span><span class="v">${ui.soles(op.precioDescontado)}</span></div>
        <div class="row"><span class="k">Fee de originación</span><span class="v">${ui.soles(op.fee)}</span></div>
        <div class="row"><span class="k">Retenido (Capa 2)</span><span class="v">${ui.soles(op.retenido)}</span></div>
        <div class="row total"><span class="k">Liberado a la PYME</span><span class="v gold">${ui.soles(op.liberadoInicial)}</span></div>
        <div class="row"><span class="k">Retorno del prestamista al vencimiento</span><span class="v emerald">${ui.soles(op.retornoPrestamista)} (+${ui.pct(op.retornoPct, 2)})</span></div>
      </div>` : `<p class="muted" style="font-size:.85rem;">Aún no tokenizada — el pricing se calcula al financiar (Etapa 3).</p>`;

    const tokenChip = f.tokenId ? `<div class="token-chip" style="margin-top:10px;">${ICON_LINK} ${f.tokenId}</div>` : '';

    const sc = f.sc ? `
      <div class="grid grid-4" style="margin-top:16px; gap:10px;">
        <div class="kpi" style="padding:12px 14px;"><div class="label">score</div><div style="font-family:var(--font-mono); font-weight:700;">${f.sc.score}</div></div>
        <div class="kpi" style="padding:12px 14px;"><div class="label">cant_$</div><div style="font-family:var(--font-mono); font-weight:700;">${f.sc['cant_$']}</div></div>
        <div class="kpi" style="padding:12px 14px;"><div class="label">tiempo_devol</div><div style="font-family:var(--font-mono); font-weight:700;">${f.sc.tiempo_devol}d</div></div>
        <div class="kpi" style="padding:12px 14px;"><div class="label">%_extra</div><div style="font-family:var(--font-mono); font-weight:700;">${ui.pct(f.sc['%_extra'], 1)}</div></div>
      </div>` : '';

    const contratoBtn = f.sc
      ? `<button class="btn btn-outline btn-block" data-action="ver-contrato" data-id="${f.id}" style="margin-top:14px;">${ICON_DOC} Ver e imprimir contrato</button>`
      : '';

    let acciones = '';
    if (f.estado === 'pendiente') {
      acciones = `<button class="btn btn-primary btn-block" data-action="tokenizar" data-id="${f.id}">${ICON_LINK} Tokenizar y financiar (Etapa 2 + 3)</button>`;
    } else if (f.estado === 'financiada') {
      acciones = `
        <button class="btn btn-emerald btn-block" data-action="pagar" data-id="${f.id}">${ICON_CHECK} Simular pago a tiempo (Rama A)</button>
        <div class="divider" style="margin:16px 0;"></div>
        <div class="muted" style="font-size:.78rem; margin-bottom:10px;">O simular un atraso (Rama B) para ver las capas de colateral en acción:</div>
        <div class="flex gap-8" style="flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" data-action="atraso" data-sev="leve" data-id="${f.id}">Atraso leve</button>
          <button class="btn btn-ghost btn-sm" data-action="atraso" data-sev="moderado" data-id="${f.id}">Atraso moderado</button>
          <button class="btn btn-danger btn-sm" data-action="atraso" data-sev="severo" data-id="${f.id}">Atraso severo</button>
        </div>`;
    } else if (f.estado === 'en_mora') {
      acciones = `
        <div class="flex gap-8" style="flex-wrap:wrap;">
          <button class="btn btn-emerald" data-action="pagar" data-id="${f.id}">Confirmar pago tardío</button>
          <button class="btn btn-danger" data-action="default" data-id="${f.id}">Marcar default → Capa 4</button>
        </div>`;
    } else {
      acciones = `<p class="muted" style="font-size:.83rem; margin:0;">Operación cerrada.</p>`;
    }

    const timeline = `
      <div class="timeline" style="margin-top:18px;">
        ${(f.historial || []).slice().reverse().map((h) => `
          <div class="timeline-item">
            <div class="t">${ui.fechaHora(h.fecha)}</div>
            <div class="d">${h.evento}</div>
          </div>`).join('')}
      </div>`;

    return `
      <div class="flex-between" style="margin-bottom:14px;">
        <div>
          <div class="cell-strong" style="font-size:1.1rem;">${ui.soles(f.monto)} · ${f.dias} días</div>
          <div class="faint" style="font-size:.78rem;">Emitida ${ui.fecha(f.fechaEmision)}${f.fechaVencimiento ? ' · vence ' + ui.fecha(f.fechaVencimiento) : ''}</div>
        </div>
        ${ui.badgeEstado(f.estado)}
      </div>
      ${tokenChip}
      ${sc}
      ${contratoBtn}
      ${receipt}
      <div class="divider"></div>
      ${acciones}
      ${timeline}
    `;
  }

  function bindAccionesDetalle() {
    document.querySelectorAll('#det-body [data-action]').forEach((btn) => {
      if (btn.dataset.action === 'ver-contrato') {
        btn.addEventListener('click', () => abrirContrato(btn.dataset.id));
      } else {
        btn.addEventListener('click', () => ejecutarAccion(btn));
      }
    });
  }

  async function ejecutarAccion(btn) {
    const { action, id, sev } = btn.dataset;
    const original = btn.innerHTML;
    document.querySelectorAll('#det-body button').forEach((b) => (b.disabled = true));
    btn.innerHTML = '<span class="spinner"></span> Procesando…';

    try {
      let msg = '';
      if (action === 'tokenizar') {
        await api.tokenizarYFinanciar(id);
        msg = 'Factura tokenizada y financiada por el pool ✓';
      } else if (action === 'pagar') {
        await api.simularPagoATiempo(id);
        msg = 'Pago confirmado — retorno repartido a los prestamistas ✓';
      } else if (action === 'atraso') {
        await api.simularAtraso(id, sev);
        msg = 'Atraso registrado — score y colateral actualizados';
      } else if (action === 'default') {
        await api.marcarDefault(id);
        msg = 'Default registrado — cubierto por el fondo de garantía (Capa 4)';
      }
      ui.toast(msg, action === 'default' ? 'warn' : 'ok');
      await refrescar();
      await abrirDetalle(id); // re-render con el nuevo estado
    } catch (err) {
      ui.toast(err.message || 'No se pudo completar la acción', 'error');
      btn.innerHTML = original;
      document.querySelectorAll('#det-body button').forEach((b) => (b.disabled = false));
    }
  }

  function bindGlobalActions() {
    document.getElementById('btn-logout').addEventListener('click', async () => {
      await api.cerrarSesion();
      window.location.href = 'index.html';
    });
    document.getElementById('banner-ranking').addEventListener('click', abrirPerfil);
  }

  // -------------------- Modal: Contrato imprimible --------------------
  let firmaCanvas, firmaCtx, firmando = false, firmaTieneTrazo = false;

  function bindModalContrato() {
    document.getElementById('btn-imprimir-contrato').addEventListener('click', () => window.print());
    document.getElementById('btn-limpiar-firma').addEventListener('click', limpiarFirma);
  }

  function iniciarFirmaCanvas() {
    firmaCanvas = document.getElementById('firma-canvas');
    if (!firmaCanvas) return;
    firmaCtx = firmaCanvas.getContext('2d');
    firmaCtx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#14120f';
    firmaCtx.lineWidth = 2.2;
    firmaCtx.lineCap = 'round';
    firmaTieneTrazo = false;

    const posicion = (e) => {
      const r = firmaCanvas.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return { x: (p.clientX - r.left) * (firmaCanvas.width / r.width), y: (p.clientY - r.top) * (firmaCanvas.height / r.height) };
    };
    const empezar = (e) => { firmando = true; firmaTieneTrazo = true; const p = posicion(e); firmaCtx.beginPath(); firmaCtx.moveTo(p.x, p.y); e.preventDefault(); };
    const mover = (e) => { if (!firmando) return; const p = posicion(e); firmaCtx.lineTo(p.x, p.y); firmaCtx.stroke(); e.preventDefault(); };
    const terminar = () => { firmando = false; };

    firmaCanvas.addEventListener('mousedown', empezar);
    firmaCanvas.addEventListener('mousemove', mover);
    window.addEventListener('mouseup', terminar);
    firmaCanvas.addEventListener('touchstart', empezar, { passive: false });
    firmaCanvas.addEventListener('touchmove', mover, { passive: false });
    firmaCanvas.addEventListener('touchend', terminar);
  }

  function limpiarFirma() {
    if (!firmaCtx || !firmaCanvas) return;
    firmaCtx.clearRect(0, 0, firmaCanvas.width, firmaCanvas.height);
    firmaTieneTrazo = false;
  }

  async function abrirContrato(id) {
    const f = await api.getFactura(id);
    if (!f || !f.sc) return;
    document.getElementById('contract-doc').innerHTML = renderContrato(f, pyme);
    ui.closeModal('modal-detalle');
    ui.openModal('modal-contrato');
    setTimeout(iniciarFirmaCanvas, 60);
  }

  function renderContrato(f, p) {
    const op = f.pricing;
    const walletCorta = ui.corto(p.wallet, 14);
    return `
      <div class="contract-head">
        <img src="assets/mascota-facturafi.jpg" class="contract-logo" alt="FacturaFi">
        <div>
          <h2>FacturaFi</h2>
          <p class="muted mb-0">Contrato de Cesión de Factura Negociable</p>
        </div>
        <div class="contract-id">N° ${f.id.split('_')[1].toUpperCase()}<br>${f.tokenId || 'sin token'}</div>
      </div>

      <div class="contract-section">
        <h4>I. Partes</h4>
        <div class="contract-grid">
          <div><span class="k">Cedente (PYME)</span><span class="v">${p.nombre}</span></div>
          <div><span class="k">RUC</span><span class="v">${p.ruc}</span></div>
          <div><span class="k">Rubro</span><span class="v">${p.rubro}</span></div>
          <div><span class="k">Contacto</span><span class="v">${p.email || '—'}${p.telefono ? ' · ' + p.telefono : ''}</span></div>
          <div><span class="k">Wallet cedente</span><span class="v mono">${walletCorta}</span></div>
          <div><span class="k">Deudor (pagador)</span><span class="v">${f.deudor}</span></div>
        </div>
      </div>

      <div class="contract-section">
        <h4>II. Términos de la operación</h4>
        <div class="contract-grid">
          <div><span class="k">Monto de la factura</span><span class="v">${ui.soles(f.monto)}</span></div>
          <div><span class="k">Plazo</span><span class="v">${f.dias} días</span></div>
          <div><span class="k">Fecha de emisión</span><span class="v">${new Date(f.fechaEmision).toLocaleDateString('es-PE')}</span></div>
          <div><span class="k">Fecha de vencimiento</span><span class="v">${f.fechaVencimiento ? new Date(f.fechaVencimiento).toLocaleDateString('es-PE') : '—'}</span></div>
          <div><span class="k">Score al emitir</span><span class="v">${f.scoreAlEmitir} / 10</span></div>
          <div><span class="k">Tasa aplicada (%_extra)</span><span class="v">${op ? ui.pct(op.tasaFinal, 2) : '—'}</span></div>
          <div><span class="k">Monto liberado</span><span class="v">${op ? ui.soles(op.liberadoInicial) : '—'}</span></div>
          <div><span class="k">Estado actual</span><span class="v">${f.estado}</span></div>
        </div>
      </div>

      <div class="contract-section">
        <h4>III. Cláusula legal</h4>
        <p class="muted">Esta operación se rige por la Ley N° 29623, que promueve el financiamiento a través de la factura comercial. La Factura Negociable es un título valor transferible por endoso; el deudor mantiene la obligación legal de pago, con la indemnización correspondiente en caso de mala fe. El Cedente declara que la información aquí consignada es veraz y cede el derecho de cobro descrito a favor del pool de FacturaFi, bajo los términos calculados por el smart contract y sujeto a las capas de protección documentadas (respaldo legal, retención parcial, score on-chain y fondo de garantía).</p>
      </div>

      <div class="contract-section contract-firma">
        <h4>IV. Firma</h4>
        <p class="muted">Yo, representante de ${p.nombre}, acepto los términos de esta cesión de derecho de cobro.</p>
        <canvas id="firma-canvas" width="480" height="140"></canvas>
        <div class="contract-firma-meta">
          <span>Firma digital (wallet): <span class="mono">${walletCorta}</span></span>
          <span>Fecha: ${new Date().toLocaleString('es-PE')}</span>
        </div>
      </div>
    `;
  }
})();
