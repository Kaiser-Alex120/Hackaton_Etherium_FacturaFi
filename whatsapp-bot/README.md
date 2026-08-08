# Bot de WhatsApp — FacturaFi

Servidor Node.js que usa [open-wa](https://www.open-wa.org/) para mandar
notificaciones reales por WhatsApp cuando pasa algo importante con una
factura: se tokeniza y financia, se paga a tiempo, entra en mora, o cae
en default.

El frontend (`js/api.js`) ya está conectado a este servidor — si está
corriendo, las notificaciones salen solas. Si no está corriendo, el
frontend simplemente lo ignora y sigue funcionando en modo demo normal.

## Requisitos

- [Node.js](https://nodejs.org) 18 o superior.
- Un número de WhatsApp para el bot. **Usa uno secundario, no tu WhatsApp
  personal principal** — open-wa automatiza WhatsApp Web de forma no
  oficial (no es la API de Meta), y WhatsApp puede banear números que
  detecte como automatizados si se usa mucho.

## Instalación y arranque

```bash
cd whatsapp-bot
npm install
npm start
```

La primera vez va a aparecer un **código QR en la terminal**. Escanéalo
desde el WhatsApp del número que vas a usar como bot:

`WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo`

Cuando veas `✅ WhatsApp conectado` en la terminal, el bot ya está listo.
Déjalo corriendo mientras usas FacturaFi en el navegador.

## Endpoints

- `POST /notificar` — body `{ "telefono": "51987654321", "mensaje": "..." }`
- `GET /salud` — devuelve `{ ok: true, conectado: true|false }`

## Notas

- El teléfono debe incluir el código de país sin `+` (ej. `51` para Perú).
- Si cierras la terminal, el bot se desconecta y las notificaciones dejan
  de enviarse — el frontend no se rompe, solo deja de notificar.
- Para producción de verdad (no hackathon), lo correcto es migrar a la
  [API oficial de WhatsApp Business (Meta)](https://developers.facebook.com/docs/whatsapp),
  que no depende de mantener una sesión de WhatsApp Web abierta ni corre
  riesgo de baneo — pero requiere aprobación de cuenta de negocio y
  plantillas de mensaje pre-aprobadas, lo cual toma más tiempo que 48h.
