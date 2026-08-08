/* ============================================================
   FacturaFi — registro-inversionista.js
   Registro del prestamista — sesión independiente de la PYME.
   ============================================================ */

(function () {
  document.addEventListener('DOMContentLoaded', async () => {
    const existente = await FF.api.getInversionista();
    if (existente) {
      window.location.href = 'pool.html';
      return;
    }

    const CAMPOS_REQUERIDOS = ['nombre', 'email', 'telefono'];
    const warning = document.getElementById('form-warning');
    const terminos = document.getElementById('acepto-terminos');

    function limpiarError(id) {
      document.getElementById(id).closest('.field').classList.remove('has-error');
    }
    function validarCampo(id) {
      const el = document.getElementById(id);
      const valido = el.checkValidity() && el.value.trim() !== '';
      el.closest('.field').classList.toggle('has-error', !valido);
      return valido;
    }
    CAMPOS_REQUERIDOS.forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener('input', () => limpiarError(id));
      el.addEventListener('change', () => limpiarError(id));
    });
    terminos.addEventListener('change', () => terminos.closest('.terms-row').classList.remove('has-error'));

    document.getElementById('form-registro').addEventListener('submit', async (e) => {
      e.preventDefault();

      const todoValido = CAMPOS_REQUERIDOS.map(validarCampo).every(Boolean);
      const aceptoValido = terminos.checked;
      terminos.closest('.terms-row').classList.toggle('has-error', !aceptoValido);

      if (!todoValido || !aceptoValido) {
        warning.style.display = 'flex';
        FF.ui.toast(!aceptoValido ? 'Debes aceptar los términos y condiciones' : 'No se registraron tus datos correctamente — revisa los campos marcados', 'error');
        document.querySelector('.field.has-error input')?.focus();
        return;
      }
      warning.style.display = 'none';

      const btn = document.getElementById('btn-submit');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Creando cuenta…';

      try {
        await FF.api.registrarInversionista({
          nombre: document.getElementById('nombre').value.trim(),
          email: document.getElementById('email').value.trim(),
          telefono: document.getElementById('telefono').value.trim(),
        });
        FF.ui.toast('¡Cuenta creada! Recibiste 10,000 USDC de bienvenida para invertir.');
        window.location.href = 'pool.html';
      } catch (err) {
        FF.ui.toast(err.message || 'No se pudo crear la cuenta', 'error');
        btn.disabled = false;
        btn.textContent = 'Crear cuenta y entrar al marketplace';
      }
    });
  });
})();
