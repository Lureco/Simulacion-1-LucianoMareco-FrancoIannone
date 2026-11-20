/**
 * src/ui/portapapeles.js — Copiar texto al portapapeles (F8/T68)
 * ==============================================================
 *
 * Usa la API moderna `navigator.clipboard.writeText` cuando está disponible
 * (requiere contexto seguro / HTTPS) y cae al `document.execCommand('copy')`
 * clásico si no, por ejemplo sirviendo el build por `http://localhost`.
 *
 * El entorno se pasa por parámetro para poder probarlo sin navigateur: en la
 * app se llama sin argumentos y se usa `globalThis`.
 *
 * @param {string} texto
 * @param {object} [entorno]
 * @returns {Promise<boolean>} `true` si el portapapeles quedó con el texto.
 */
export async function copiarTexto(texto, entorno = globalThis) {
  const navigator = entorno.navigator;
  if (navigator?.clipboard?.writeText !== undefined) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Permisos denegados o contexto inseguro: se prueba el fallback.
    }
  }

  const document = entorno.document;
  if (document?.createElement === undefined || document?.body?.appendChild === undefined) {
    return false;
  }

  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select?.();

  let copiado;
  try {
    copiado = document.execCommand?.('copy') === true;
  } catch {
    copiado = false;
  }
  area.remove?.();

  return copiado;
}
