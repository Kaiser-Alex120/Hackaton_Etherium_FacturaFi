/* ============================================================
   FacturaFi — web3.js
   ============================================================
   Capa de conexión con la wallet del usuario, usando ethers.js
   (cargado como <script> global desde CDN en el <head> de cada
   página — ver ethers.umd.min.js antes de este archivo).

   Qué hace HOY: conectar/desconectar MetaMask, exponer address,
   signer, provider y la red activa. Es la base para que el
   backend enchufe el contrato real (ver contract.config.js).

   Qué NO hace todavía: llamar funciones del contrato — eso
   depende de que el compañero de backend complete
   contract.config.js con la dirección y el ABI reales. Una vez
   completado, api.js es el único archivo que necesita
   actualizarse (ver el comentario al inicio de api.js).

   Si no hay MetaMask instalado o ethers.js no cargó (sin
   internet en el venue), toda esta capa se desactiva sola y
   el resto de la app sigue funcionando en modo demo.
   ============================================================ */

window.FF = window.FF || {};

FF.web3 = (function () {
  let provider = null;
  let signer = null;
  let address = null;
  let chainId = null;
  const listeners = new Set();

  function walletInstalada() {
    return typeof window.ethereum !== 'undefined';
  }

  function ethersListo() {
    return typeof window.ethers !== 'undefined';
  }

  function notify() {
    const s = estado();
    listeners.forEach((cb) => cb(s));
  }

  async function conectar() {
    if (!walletInstalada()) {
      FF.ui && FF.ui.toast('No se detectó una wallet — instala MetaMask para conectar de verdad', 'warn');
      return null;
    }
    if (!ethersListo()) {
      FF.ui && FF.ui.toast('ethers.js no cargó (¿sin internet?) — seguimos en modo demo', 'error');
      return null;
    }
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      signer = await provider.getSigner();
      address = accounts[0] || null;
      const net = await provider.getNetwork();
      chainId = Number(net.chainId);

      window.ethereum.removeAllListeners && window.ethereum.removeAllListeners('accountsChanged');
      window.ethereum.on && window.ethereum.on('accountsChanged', (accs) => {
        address = accs[0] || null;
        if (!address) { provider = signer = null; chainId = null; }
        notify();
      });
      window.ethereum.on && window.ethereum.on('chainChanged', () => window.location.reload());

      notify();
      FF.ui && FF.ui.toast(`Wallet conectada: ${corto(address)}`);
      return address;
    } catch (err) {
      FF.ui && FF.ui.toast(err.message || 'No se pudo conectar la wallet', 'error');
      return null;
    }
  }

  function desconectar() {
    provider = signer = address = chainId = null;
    notify();
  }

  function estado() {
    return { conectado: !!address, address, chainId, provider: !!provider };
  }

  function on(cb) { listeners.add(cb); return () => listeners.delete(cb); }

  function corto(addr) {
    return addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : '';
  }

  // Reconexión silenciosa si la wallet ya había autorizado el sitio antes
  async function intentarReconectar() {
    if (!walletInstalada() || !ethersListo()) return;
    try {
      const accs = await window.ethereum.request({ method: 'eth_accounts' });
      if (accs && accs.length) await conectar();
    } catch (e) { /* silencioso — no forzamos nada en el primer load */ }
  }

  return {
    walletInstalada, ethersListo, conectar, desconectar, estado, on, corto,
    getSigner: () => signer, getProvider: () => provider,
    intentarReconectar,
  };
})();

document.addEventListener('DOMContentLoaded', () => FF.web3.intentarReconectar());
