/**
 * Formata telefone para exibição: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 * Aceita string com ou sem formatação — extrai apenas dígitos.
 * Retorna string vazia se não houver dígitos suficientes.
 */
export function formatPhoneDisplay(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 10) return digits;
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // 11 dígitos (celular com 9)
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Remove tudo que não é dígito e limita a 11 caracteres.
 * Para uso em onChange de inputs de telefone.
 */
export function stripNonDigits(value) {
  if (!value) return '';
  return String(value).replace(/\D/g, '').slice(0, 11);
}
