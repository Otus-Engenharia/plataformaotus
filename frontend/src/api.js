/**
 * URL base da API.
 * - VITE_API_URL vazio (Docker/same-origin): usa '' → URLs relativas /api/...
 * - VITE_API_URL definido (dev com outro host): usa o valor.
 * - Fallback '' evita localhost quando acessando pelo VPS.
 */
export const API_URL = import.meta.env.VITE_API_URL ?? '';
