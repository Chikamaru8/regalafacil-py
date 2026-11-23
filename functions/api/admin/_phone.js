// Devuelve el teléfono en formato internacional sin símbolos (ej. 595981123456) o null si no es válido.
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '595' + d.slice(1);
  else if (d.length === 9 && d.startsWith('9')) d = '595' + d;
  return /^\d{11,13}$/.test(d) ? d : null;
}
