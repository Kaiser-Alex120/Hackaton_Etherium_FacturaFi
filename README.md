# Prouecyo Hackatom Etherium FacturaFi

**Factoring de facturas on-chain para PYMEs peruanas.**
FacturaFi convierte facturas por cobrar de PYMEs peruanas en liquidez inmediata, sin bancos. La PYME sube su factura, se tokeniza como un derecho de cobro único e inmutable, y un pool de inversionistas en stablecoins la financia al instante con un descuento calculado según el riesgo real de la operación. Cuando el cliente paga, el smart contract reparte automáticamente el retorno.
🔗 **Demo en vivo:** [hackaton-facturafi.vercel.app](https://hackaton-facturafi.vercel.app)

> Proyecto construido para un hackathon (track RWA / DeFi / Stablecoins).

## Cómo funciona

- **PYME**: sube una factura → la protocolo la tokeniza → recibe el adelanto en stablecoins (USDC) al instante.
- **Inversionista**: aporta liquidez al pool → recibe el capital + descuento cuando el pagador salda la factura.
- **Protección**: la factura es un título valor bajo la ley peruana (Ley 29623), se retiene parte del adelanto hasta confirmar el pago, cada PYME tiene un score on-chain que solo baja si incumple, y un fondo de garantía compartido cubre lo que las capas anteriores no alcancen.
- **Modelo de negocio**: fee de originación de ~1% por factura procesada.

Más detalle en la documentación de producto (ver [Documentación](#documentación) abajo).

## Estructura del proyecto

Sitio estático (sin build step) + un bot de notificaciones aparte:

```
index.html                  Landing page
registro.html                Registro de PYME
registro-inversionista.html  Registro de inversionista
pool.html                    Pool de inversión / liquidez
dashboard.html                Dashboard de facturas y contratos

css/styles.css                Estilos del sitio

js/
  web3.js                     Conexión de wallet (MetaMask) vía ethers.js
  contract.config.js          Dirección y ABI del smart contract real
  contract.js                 Llamadas de lectura al contrato real
  api.js                       Capa de datos de la app (modo demo con localStorage)
  pricing.js                  Cálculo de descuento/score
  dashboard.js, pool.js,
  registro.js, registro-inversionista.js,
  ui.js, web3ui.js, assistant.js, index.js, mockdb.js

assets/                       Imágenes y video usados por el sitio

whatsapp-bot/                 Servidor Node aparte para notificaciones por WhatsApp
                               (ver su propio README)

ABI.txt, appJXS.txt,
useSmartContract.j.txt        Material de referencia entregado por el equipo de
                               backend (ABI y ejemplo de integración en React)

FacturaFi-*.md, FACTORIFI.guion.md   Documentación de producto y guion de pitch
```

## Stack técnico

- HTML / CSS / JavaScript vanilla, sin build step ni framework de frontend.
- [ethers.js](https://docs.ethers.org/) v6 (cargado por CDN) para la conexión con MetaMask y la lectura del smart contract.
- Smart contract en Ethereum (ver `js/contract.config.js` para la dirección y el ABI desplegados).
- Modo demo: mientras no todas las acciones estén migradas a escritura real en el contrato, la app funciona con datos en `localStorage` (ver comentarios en `js/api.js`).
- Despliegue actual en [Vercel](https://vercel.com) como sitio estático.

## Correr el proyecto en local

No requiere instalación ni build: es HTML estático.

```bash
# Opción 1: abrir index.html directamente en el navegador

# Opción 2: servirlo con cualquier servidor estático, por ejemplo:
npx serve .
```

Para probar la conexión de wallet necesitas la extensión [MetaMask](https://metamask.io/) instalada en el navegador. Si no hay wallet o no cargó ethers.js, el sitio sigue funcionando en modo demo.

### Bot de WhatsApp (opcional)

El frontend puede disparar notificaciones por WhatsApp cuando pasa algo con una factura. Es un servidor Node aparte y opcional — si no está corriendo, el sitio simplemente lo ignora. Instrucciones completas en [`whatsapp-bot/README.md`](whatsapp-bot/README.md).

## Documentación

- [`FacturaFi-Indice-General (1).md`](<FacturaFi-Indice-General (1).md>) — índice de toda la documentación.
- [`FacturaFi-Documento-Producto-Extenso (1).md`](<FacturaFi-Documento-Producto-Extenso (1).md>) — documento de producto completo.
- [`FacturaFi-Anexo-Tecnico-Ethereum (1).md`](<FacturaFi-Anexo-Tecnico-Ethereum (1).md>) — anexo técnico (Ethereum / smart contract).
- [`FacturaFi-Anexo-Teorico-Matematico (1).md`](<FacturaFi-Anexo-Teorico-Matematico (1).md>) — anexo teórico-matemático (pricing / riesgo).
- [`FACTORIFI.guion.md`](FACTORIFI.guion.md) — guion de pitch.

## Despliegue

El sitio, al no requerir build, se despliega tal cual:

- **Vercel** (actual): el repo está enlazado al proyecto `hackaton-facturafi`. Conectar este repo de GitHub en Vercel habilita auto-deploy en cada push a `main`.
- **Cualquier hosting estático**: subir el contenido del repo (menos `whatsapp-bot/`, que es un servicio aparte) alcanza para servir el sitio.

No hay variables de entorno necesarias para el frontend estático.
