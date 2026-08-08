/* ============================================================
   FacturaFi — contract.config.js
   ============================================================
   ABI y dirección REALES del contrato desplegado por el equipo
   de backend (recibidos en ABI.txt / useSmartContract.j.txt).

   Este contrato es más simple que nuestro modelo de mock (api.js):
   maneja Usuario → Contrato (préstamo con cuotas) → Factura
   (vinculada a un contrato), en vez de facturas independientes
   con score/tasa dinámica. Por eso el frontend sigue funcionando
   en modo demo (localStorage) para la experiencia principal, y
   este módulo se usa para llamadas de LECTURA reales y seguras
   (ver js/contract.js) — el puente hacia escritura real queda
   listo para cuando se decida migrar cada acción de api.js.
   ============================================================ */

window.FF = window.FF || {};

FF.contractConfig = {
  CONTRACT_ADDRESS: '0x62B34fDEa06121d537E02de1E871CBFf0124F790',

  // ABI "human-readable" de ethers.js — tal como la exportó el equipo de backend.
  CONTRACT_ABI: [
    'function contadorContratos() view returns (uint256)',
    'function contadorFacturas() view returns (uint256)',
    'function registrarUsuario(address _wallet, string _codigo, string _nombre, string _dni) public',
    'function registrarContrato(address _walletUsuario, uint256 _cuotas, uint256 _porcentajeMensual, uint256 _tiempoDePago, string _descripcion, string _observaciones, uint256 _valorPrestamo, uint256 _valorColateral) public',
    'function registrarFactura(uint256 _contratoId, string _codigo, string _descripcion, string _observaciones, uint256 _monto) public',
    'function obtenerInformacionUsuario(address _wallet) view returns (string codigo, string nombre, string dni)',
    'function obtenerInformacionContrato(uint256 _contratoId) view returns (address walletUsuario, uint256 cuotas, uint256 pagadas, uint256 porcentajeMensual, uint256 tiempoDePago, string descripcion, string observaciones, uint256 valorPrestamo, uint256 valorColateral, uint256[] listaFacturasPagadas)',
    'function obtenerInformacionFactura(uint256 _facturaId) view returns (string codigo, uint256 fechaEmision, string descripcion, string observaciones, uint256 monto, uint256 contratoId)',
  ],

  // TODO(backend): confirmar la red exacta donde está desplegado (Sepolia, Base Sepolia, etc.)
  network: { chainId: null, name: null },

  get listo() {
    return Boolean(this.CONTRACT_ADDRESS && this.CONTRACT_ABI.length);
  },
};
