/* ============================================================
   FacturaFi — assistant.js
   ============================================================
   Asistente flotante con la mascota. Es un ayudante de preguntas
   frecuentes por coincidencia de palabras clave — NO es un LLM
   conectado a ninguna API (eso requeriría backend propio para no
   exponer una API key en el navegador). Se lo dice al usuario
   desde el primer mensaje para no generar expectativas falsas.

   Si más adelante se conecta un LLM real: el único lugar a tocar
   es `responder()` — cambiar la búsqueda en KB por un fetch al
   backend, manteniendo el resto de la UI intacta.
   ============================================================ */

window.FF = window.FF || {};

FF.assistant = (function () {

  const KB = [
    {
      id: 'no-paga',
      keywords: ['no paga', 'no pagan', 'impago', 'default', 'mora', 'atraso', 'no cobro', 'que pasa si'],
      pregunta: '¿Qué pasa si el deudor no paga?',
      respuesta: 'Cuatro capas absorben la pérdida en orden: respaldo legal, retención parcial (~7%), tu score on-chain, y un fondo de garantía compartido. Te muestro el detalle:',
      accion: { label: 'Ver las 4 capas de protección', href: 'index.html#colateral' },
    },
    {
      id: 'score',
      keywords: ['historial', 'bancario', 'credito', 'crédito', 'puntaje', 'reputacion', 'reputación'],
      pregunta: '¿Necesito historial bancario?',
      respuesta: 'No. Todo usuario nace con score 0 y lo construye con cada operación bien pagada — nunca según tu historial bancario tradicional.',
      accion: { label: 'Registrarme y empezar mi historial', href: 'registro.html' },
    },
    {
      id: 'como-sube-score',
      keywords: ['como sube', 'cómo sube', 'como subo mi score', 'cómo subo mi score', 'aumentar mi score', 'mejorar mi score', 'subir de nivel', 'como funciona el score', 'cómo funciona el score', 'niveles de score', 'categorias de riesgo', 'categorías de riesgo', 'score'],
      pregunta: '¿Cómo sube mi score?',
      respuesta: 'Empiezas en 0. Cada factura pagada a tiempo te suma puntos; un atraso te resta (más fuerte mientras más largo sea el atraso) — el default te devuelve a 0. Hay 3 niveles: 0-3 riesgo alto (tasa más cara, menos % liberado), 4-7 riesgo medio, y 8-10 riesgo bajo (tasa más barata, hasta 95% liberado de inmediato). La prima de riesgo se calcula matemáticamente sobre tu score exacto, no solo por nivel — cada punto cuenta.',
      accion: { label: 'Ver mi score en el dashboard', href: 'dashboard.html' },
    },
    {
      id: 'token',
      keywords: ['token', 'erc-721', 'erc721', 'erc-3525', 'nft', 'tokeniza'],
      pregunta: '¿En qué estándar se tokeniza la factura?',
      respuesta: 'ERC-721 para el MVP — cada factura es un token único e indivisible. ERC-3525 queda como evolución natural para fraccionarla entre varios prestamistas.',
    },
    {
      id: 'seguridad',
      keywords: ['exploit', 'seguridad', 'reentrancy', 'hackeo', 'vulnerabilidad', 'auditoria', 'auditoría'],
      pregunta: '¿Cómo se protege al prestamista de un exploit?',
      respuesta: 'El contrato sigue Checks-Effects-Interactions en toda función que mueve fondos, para eliminar reentrancy — el error más común en contratos de hackathon.',
    },
    {
      id: 'cobro',
      keywords: ['usdc', 'wallet', 'cobro', 'plata', 'dinero', 'stablecoin', 'lemon', 'tarjeta'],
      pregunta: '¿Cómo cobra la PYME?',
      respuesta: 'El adelanto llega en USDC a cualquier wallet — incluidas apps con tarjeta como Lemon Cash. Nunca gestionamos tu wallet, solo transferimos a ella.',
      accion: { label: 'Simular mi primera factura', href: 'registro.html' },
    },
    {
      id: 'que-es-usdc-eth',
      keywords: ['que es usdc', 'qué es usdc', 'que es ethereum', 'qué es ethereum', 'que es una stablecoin', 'qué es una stablecoin', 'que es blockchain', 'qué es blockchain', 'que es un smart contract', 'qué es un smart contract', 'no entiendo usdc', 'no entiendo ethereum'],
      pregunta: '¿Qué son USDC y Ethereum?',
      respuesta: 'USDC es una stablecoin: cada token vale 1 dólar, respaldado 1:1 por reservas reales — dólares digitales que se mueven en segundos, sin la volatilidad de otras criptomonedas. Ethereum es la red blockchain pública donde vive nuestro smart contract: un registro compartido y verificable por cualquiera, que ninguna empresa controla sola. No inventamos infraestructura nueva — usamos la misma que ya mueve miles de millones de dólares al día.',
    },
    {
      id: 'fee',
      keywords: ['fee', 'cobran', 'comision', 'comisión', 'cuanto cuesta', 'cuánto cuesta', 'tasa', 'costo'],
      pregunta: '¿Cuánto cobra FacturaFi?',
      respuesta: '~1% de fee de originación, aparte del descuento del pool (varía con plazo, score y utilización). Pruébalo tú mismo:',
      accion: { label: 'Abrir la calculadora de tasas', href: 'index.html#pricing' },
    },
    {
      id: 'que-es',
      keywords: ['que es facturafi', 'qué es facturafi', 'de que trata', 'de qué trata', 'como funciona', 'cómo funciona'],
      pregunta: '¿Qué es FacturaFi?',
      respuesta: 'Tokenizamos tu factura por cobrar, un pool de prestamistas en stablecoins la financia al instante, y el contrato reparte el retorno cuando te pagan. Sin bancos.',
      accion: { label: 'Ver el flujo de 4 etapas', href: 'index.html#como-funciona' },
    },
    {
      id: 'empezar',
      keywords: ['empezar', 'registrar', 'registro', 'como empiezo', 'cómo empiezo', 'crear cuenta', 'unirme'],
      pregunta: '¿Cómo empiezo?',
      respuesta: 'No necesitas historial bancario. En dos minutos subes tu primera factura y ves la tokenización y el pricing en vivo:',
      accion: { label: 'Registrarme como PYME', href: 'registro.html' },
    },
    {
      id: 'saludo',
      keywords: ['hola', 'buenas', 'hey', 'hi', 'que tal', 'qué tal'],
      pregunta: null,
      respuesta: '¡Hola! ¿En qué te ayudo? Pregúntame sobre el score, la tokenización, o cómo empezar.',
    },
    {
      id: 'como-usar-pyme',
      keywords: ['como uso el dashboard', 'cómo uso el dashboard', 'como funciona el dashboard', 'ayuda pyme'],
      pregunta: '¿Cómo uso el dashboard como PYME?',
      respuesta: '1) Click en "+ Nueva factura" y completa deudor, monto y plazo. 2) Abre la factura y presiona "Tokenizar y financiar" — ahí se calcula tu tasa y recibes el adelanto al instante. 3) Cuando el deudor pague, usa "Simular pago a tiempo" para ver el reparto automático y tu score subir. Tu perfil (foto, contacto, link de tu MYPE) lo editas haciendo click en tu nombre, arriba a la izquierda.',
    },
    {
      id: 'como-usar-prestamista',
      keywords: ['como uso el pool', 'cómo uso el pool', 'como funciona el pool', 'ayuda prestamista', 'como invierto'],
      pregunta: '¿Cómo uso la vista del pool como prestamista?',
      respuesta: '1) Revisa la tasa actual y la utilización del pool arriba — a más utilización, mejor tasa para atraer capital. 2) En "Depositar / retirar", ingresa un monto en USDC y presiona Depositar — tu capital se diversifica entre todas las facturas activas, no una sola. 3) A medida que las facturas se pagan, tu posición acumula capital + interés. Puedes retirar cuando quieras, sujeto a la liquidez disponible del pool en ese momento.',
    },
    {
      // Catch-all de orientación — atrapa preguntas genéricas tipo
      // "¿a dónde voy?" que no calzan con las entradas específicas de arriba.
      // Debe quedar AL FINAL del arreglo: buscar() devuelve el primer match,
      // así que las entradas específicas siempre ganan primero.
      id: 'guia-general',
      keywords: [
        'como uso', 'cómo uso', 'como se usa', 'cómo se usa', 'como funciona esto', 'cómo funciona esto',
        'a donde voy', 'a dónde voy', 'adonde voy', 'que hago', 'qué hago', 'no se que hacer', 'no sé qué hacer',
        'no entiendo', 'estoy perdido', 'estoy perdida', 'ayuda', 'guia', 'guía', 'tutorial',
        'por donde empiezo', 'por dónde empiezo', 'necesito saber', 'como usar esta app', 'cómo usar esta app',
      ],
      pregunta: null, // se genera según la página actual — ver respuestaGuiaGeneral()
      respuesta: null,
    },
  ];

  function respuestaGuiaGeneral() {
    const path = window.location.pathname;
    if (path.includes('dashboard')) {
      return 'Estás en tu dashboard de PYME. Para empezar: 1) Click en "+ Nueva factura" y completa deudor, monto y plazo. 2) Ábrela y presiona "Tokenizar y financiar" para recibir el adelanto al instante. 3) Simula el pago para ver tu score subir. Edita tu perfil haciendo click en tu nombre, arriba a la izquierda.';
    }
    if (path.includes('pool')) {
      return 'Estás en la vista del pool (prestamista). Ve a "Depositar / retirar", pon un monto en USDC y presiona Depositar — tu capital se diversifica automáticamente entre todas las facturas activas y acumula retorno a medida que se pagan.';
    }
    if (path.includes('registro')) {
      return 'Estás en el registro. Completa el formulario (empresa, RUC, rubro, correo, teléfono) — no necesitas historial bancario, arrancas con score 0 y lo subes con cada operación bien pagada. Al enviarlo entras directo a tu dashboard.';
    }
    return 'Todo empieza en las dos cards grandes de esta página: "Soy una PYME" si necesitas liquidez por una factura, o "Soy prestamista" si quieres depositar stablecoins y ganar retorno. Elige una y te llevamos directo al flujo correspondiente.';
  }

  const QUICK = ['no-paga', 'score', 'fee', 'empezar'];

  function normalizar(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function buscar(texto) {
    const t = normalizar(texto);
    for (const item of KB) {
      if (item.keywords.some((k) => t.includes(normalizar(k)))) return item;
    }
    return null;
  }

  let body, panel, fab, form, input;
  let abierto = false;
  let primerMensajeMostrado = false;

  function crearMarkup() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button class="assistant-fab" id="assistant-fab" aria-label="Abrir asistente FacturaFi">
        <img src="assets/mascota-facturafi.jpg" alt="Asistente FacturaFi">
        <span class="ping"></span>
      </button>
      <div class="assistant-panel" id="assistant-panel">
        <div class="assistant-head">
          <div class="av"><img src="assets/mascota-facturafi.jpg" alt=""></div>
          <div class="meta">
            <div class="n">Asistente FacturaFi</div>
            <div class="s">En línea</div>
          </div>
          <button class="assistant-close" id="assistant-close" aria-label="Cerrar">✕</button>
        </div>
        <div class="assistant-body" id="assistant-body"></div>
        <div class="assistant-quick" id="assistant-quick"></div>
        <form class="assistant-form" id="assistant-form">
          <input type="text" id="assistant-input" placeholder="Escribe tu pregunta…" autocomplete="off">
          <button type="submit" aria-label="Enviar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </form>
      </div>`;
    document.body.appendChild(wrap);
  }

  function addMsg(texto, tipo) {
    const el = document.createElement('div');
    el.className = 'msg ' + (tipo === 'user' ? 'msg-user' : 'msg-bot');
    el.textContent = texto;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }

  function addAction(accion) {
    const a = document.createElement('a');
    a.className = 'msg-action';
    a.href = accion.href;
    if (/^https?:\/\//.test(accion.href)) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    a.innerHTML = `${accion.label} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
    body.appendChild(a);
    body.scrollTop = body.scrollHeight;
  }

  function renderQuick() {
    const cont = document.getElementById('assistant-quick');
    cont.innerHTML = QUICK.map((id) => {
      const item = KB.find((k) => k.id === id);
      return `<button type="button" data-id="${id}">${item.pregunta}</button>`;
    }).join('');
    cont.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = KB.find((k) => k.id === btn.dataset.id);
        addMsg(item.pregunta, 'user');
        responder(item.pregunta);
      });
    });
  }

  function responder(texto) {
    const item = buscar(texto);
    setTimeout(() => {
      if (item) {
        const respuestaFinal = item.id === 'guia-general' ? respuestaGuiaGeneral() : item.respuesta;
        addMsg(respuestaFinal, 'bot');
        if (item.accion) addAction(item.accion);
      } else {
        addMsg('No tengo una respuesta guionada para eso — soy un asistente de preguntas frecuentes, no una IA conectada. Prueba con alguna de estas, o si necesitas más información escríbenos directo:', 'bot');
        addMsg('Tel: +51 903 483 484 · Correo: CHISPI01@gmail.com — te respondemos pronto. ¡Gracias por comunicarte!', 'bot');
        addAction({ label: 'Hablar con un asesor por WhatsApp', href: 'https://wa.me/51903483484?text=' + encodeURIComponent('Hola, tengo una pregunta sobre FacturaFi: ' + texto) });
      }
    }, 420);
  }

  function abrir() {
    panel.classList.add('open');
    abierto = true;
    if (!primerMensajeMostrado) {
      primerMensajeMostrado = true;
      addMsg('¡Hola! Soy el asistente de FacturaFi. Respondo preguntas frecuentes sobre el protocolo — no soy una IA conversacional, pero cubro lo esencial. ¿En qué te ayudo?', 'bot');
    }
    setTimeout(() => input.focus(), 200);
  }

  function cerrar() {
    panel.classList.remove('open');
    abierto = false;
  }

  // Abre el chat y simula que el usuario ya hizo esa pregunta —
  // lo usan botones "Pregúntale al asistente" fuera del widget.
  function preguntar(id) {
    const item = KB.find((k) => k.id === id);
    if (!item) return;
    const eraNuevo = !primerMensajeMostrado;
    abrir();
    setTimeout(() => {
      addMsg(item.pregunta, 'user');
      responder(item.pregunta);
    }, eraNuevo ? 750 : 200);
  }

  function init() {
    if (document.getElementById('assistant-fab')) return; // ya montado
    crearMarkup();
    fab = document.getElementById('assistant-fab');
    panel = document.getElementById('assistant-panel');
    body = document.getElementById('assistant-body');
    form = document.getElementById('assistant-form');
    input = document.getElementById('assistant-input');

    renderQuick();

    fab.addEventListener('click', () => (abierto ? cerrar() : abrir()));
    document.getElementById('assistant-close').addEventListener('click', cerrar);

    const btnAsk = document.getElementById('btn-ask-protection');
    if (btnAsk) btnAsk.addEventListener('click', () => preguntar('no-paga'));

    const btnScore = document.getElementById('btn-score-info');
    if (btnScore) btnScore.addEventListener('click', () => preguntar('score'));

    const btnComoUsar = document.getElementById('btn-como-usar');
    if (btnComoUsar) btnComoUsar.addEventListener('click', () => preguntar(btnComoUsar.dataset.kb));

    const btnScoreAyuda = document.getElementById('btn-score-ayuda');
    if (btnScoreAyuda) btnScoreAyuda.addEventListener('click', () => preguntar('como-sube-score'));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const texto = input.value.trim();
      if (!texto) return;
      addMsg(texto, 'user');
      input.value = '';
      responder(texto);
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { abrir, cerrar, preguntar };
})();
