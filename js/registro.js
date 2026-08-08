/* ============================================================
   FacturaFi — registro.js (Etapa 1)
   ============================================================ */

(function () {
  document.addEventListener('DOMContentLoaded', async () => {
    // Si ya hay una PYME registrada en este navegador, saltar directo al dashboard
    const existente = await FF.api.getPyme();
    if (existente) {
      window.location.href = 'dashboard.html';
      return;
    }

    const CAMPOS_REQUERIDOS = ['nombre', 'ruc', 'rubro', 'email', 'telefono'];
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
        document.querySelector('.field.has-error input, .field.has-error select')?.focus();
        return;
      }
      warning.style.display = 'none';

      const btn = document.getElementById('btn-submit');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Creando cuenta…';

      try {
        // La wallet se asocia después desde el perfil (Cuenta y seguridad) —
        // acá arranca con una de demo y se puede reemplazar más adelante.
        await FF.api.registrarPyme({
          nombre: document.getElementById('nombre').value.trim(),
          ruc: document.getElementById('ruc').value.trim(),
          rubro: document.getElementById('rubro').value,
          email: document.getElementById('email').value.trim(),
          telefono: document.getElementById('telefono').value.trim(),
        });
        window.location.href = 'dashboard.html';
      } catch (err) {
        FF.ui.toast(err.message || 'No se pudo crear la cuenta', 'error');
        btn.disabled = false;
        btn.textContent = 'Crear cuenta y entrar al dashboard';
      }
    });
  });
})();
