/* ============================================================
   FacturaFi — bot de notificaciones por WhatsApp (open-wa)
   ============================================================
   Qué hace: expone un servidor HTTP local con un endpoint
   POST /notificar que el frontend llama (ver js/api.js,
   función notificarWhatsApp) cada vez que pasa algo relevante
   para la PYME: factura financiada, pagada, en mora, o default.

   open-wa automatiza una sesión real de WhatsApp Web (no es la
   API oficial de Meta) — técnicamente va contra los términos de
   servicio de WhatsApp si se usa en producción a gran escala.
   Para una demo de hackathon está bien, pero usa un número
   secundario, no tu WhatsApp personal principal.

   Cómo correrlo:
     1. Instala Node.js (https://nodejs.org) si no lo tienes.
     2. En esta carpeta: npm install
     3. npm start
     4. Va a aparecer un código QR en la terminal — escanéalo con
        tu WhatsApp: Ajustes > Dispositivos vinculados > Vincular
        un dispositivo.
     5. Deja esta terminal abierta mientras usas FacturaFi — el
        frontend detecta solo si el bot está corriendo o no.
   ============================================================ */

const express = require('express');
const cors = require('cors');
const { create } = require('@open-wa/wa-automate');

const PORT = process.env.PORT || 3001;
const app = express();
app.use(cors());
app.use(express.json());

let client = null;

create({
  sessionId: 'facturafi',
  multiDevice: true,
  headless: true,
  qrTimeout: 0, // esperar indefinidamente a que se escanee el QR
  authTimeout: 0,
})
  .then((c) => {
    client = c;
    console.log('✅ WhatsApp conectado — el bot ya puede enviar notificaciones.');
  })
  .catch((err) => {
    console.error('❌ No se pudo iniciar la sesión de WhatsApp:', err.message);
  });

// open-wa espera el formato "<código país><número>@c.us", ej: 51987654321@c.us
function normalizarTelefono(tel) {
  const soloDigitos = String(tel).replace(/\D/g, '');
  return `${soloDigitos}@c.us`;
}

app.post('/notificar', async (req, res) => {
  const { telefono, mensaje } = req.body || {};
  if (!telefono || !mensaje) {
    return res.status(400).json({ ok: false, error: 'Faltan "telefono" o "mensaje" en el body' });
  }
  if (!client) {
    return res.status(503).json({ ok: false, error: 'WhatsApp todavía no está conectado — revisa si ya escaneaste el QR' });
  }
  try {
    await client.sendText(normalizarTelefono(telefono), mensaje);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/salud', (req, res) => {
  res.json({ ok: true, conectado: Boolean(client) });
});

app.listen(PORT, () => {
  console.log(`Bot de WhatsApp escuchando en http://localhost:${PORT}`);
  console.log('Esperando escaneo de QR (si es la primera vez)...');
});
