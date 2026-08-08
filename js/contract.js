/* ============================================================
   FacturaFi — contract.js
   ============================================================
   Puente real hacia el smart contract (ver contract.config.js),
   portado del useSmartContract.js del equipo de backend a JS
   plano — usa el provider/signer que ya maneja FF.web3 en vez
   de estado de React.

   Funciones de LECTURA (obtenerContadores, obtenerInformacion*)
   son gratis y seguras — no piden wallet conectada, solo un
   provider de lectura. Se usan para el widget de datos on-chain
   en pool.html.

   Funciones de ESCRITURA (registrar*) sí requieren wallet
   conectada y gastan gas — quedan listas para cuando se decida
   migrar cada acción de api.js del modo demo al contrato real.
   ============================================================ */

window.FF = window.FF || {};

FF.contract = (function () {
  function disponible() {
    return Boolean(window.ethers && FF.contractConfig && FF.contractConfig.listo);
  }

  function getContratoLectura() {
    if (!disponible()) return null;
    const provider = FF.web3.getProvider() || (window.ethereum ? new ethers.BrowserProvider(window.ethereum) : null);
    if (!provider) return null;
    return new ethers.Contract(FF.contractConfig.CONTRACT_ADDRESS, FF.contractConfig.CONTRACT_ABI, provider);
  }

  function getContratoEscritura() {
    if (!disponible()) return null;
    const signer = FF.web3.getSigner();
    if (!signer) return null;
    return new ethers.Contract(FF.contractConfig.CONTRACT_ADDRESS, FF.contractConfig.CONTRACT_ABI, signer);
  }

  // ---------------------------------------------------------
  // Lectura — gratis, sin gas, sin wallet conectada
  // ---------------------------------------------------------
  async function obtenerContadores() {
    const c = getContratoLectura();
    if (!c) return null;
    const [contratos, facturas] = await Promise.all([c.contadorContratos(), c.contadorFacturas()]);
    return { contratos: Number(contratos), facturas: Number(facturas) };
  }

  async function obtenerInformacionUsuario(wallet) {
    const c = getContratoLectura();
    if (!c) return null;
    const r = await c.obtenerInformacionUsuario(wallet);
    return { codigo: r[0], nombre: r[1], dni: r[2] };
  }

  async function obtenerInformacionContrato(id) {
    const c = getContratoLectura();
    if (!c) return null;
    const r = await c.obtenerInformacionContrato(id);
    return {
      walletUsuario: r[0],
      cuotas: Number(r[1]),
      pagadas: Number(r[2]),
      porcentajeMensual: Number(r[3]) / 100, // el contrato lo guarda x100 (550 = 5.5%)
      tiempoDePago: Number(r[4]),
      descripcion: r[5],
      observaciones: r[6],
      valorPrestamo: ethers.formatEther(r[7]),
      valorColateral: ethers.formatEther(r[8]),
      listaFacturasPagadas: r[9].map((x) => Number(x)),
    };
  }

  async function obtenerInformacionFactura(id) {
    const c = getContratoLectura();
    if (!c) return null;
    const r = await c.obtenerInformacionFactura(id);
    return {
      codigo: r[0],
      fechaEmision: new Date(Number(r[1]) * 1000),
      descripcion: r[2],
      observaciones: r[3],
      monto: ethers.formatEther(r[4]),
      contratoId: Number(r[5]),
    };
  }

  // ---------------------------------------------------------
  // Escritura — requiere wallet conectada, gasta gas
  // ---------------------------------------------------------
  async function registrarUsuario(wallet, codigo, nombre, dni) {
    const c = getContratoEscritura();
    if (!c) throw new Error('Conecta tu wallet para registrar en la blockchain');
    const tx = await c.registrarUsuario(wallet, codigo, nombre, dni);
    await tx.wait();
    return tx;
  }

  async function registrarContrato({ walletUsuario, cuotas, porcentajeMensual, tiempoDePago, descripcion, observaciones, valorPrestamo, valorColateral }) {
    const c = getContratoEscritura();
    if (!c) throw new Error('Conecta tu wallet para registrar en la blockchain');
    const tx = await c.registrarContrato(
      walletUsuario, cuotas, porcentajeMensual, tiempoDePago, descripcion, observaciones,
      ethers.parseEther(String(valorPrestamo)), ethers.parseEther(String(valorColateral))
    );
    await tx.wait();
    return tx;
  }

  async function registrarFactura({ contratoId, codigo, descripcion, observaciones, monto }) {
    const c = getContratoEscritura();
    if (!c) throw new Error('Conecta tu wallet para registrar en la blockchain');
    const tx = await c.registrarFactura(contratoId, codigo, descripcion, observaciones, ethers.parseEther(String(monto)));
    await tx.wait();
    return tx;
  }

  return {
    disponible,
    obtenerContadores, obtenerInformacionUsuario, obtenerInformacionContrato, obtenerInformacionFactura,
    registrarUsuario, registrarContrato, registrarFactura,
  };
})();
