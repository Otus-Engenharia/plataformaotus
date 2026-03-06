/**
 * Rastreamento de projetos novos via localStorage.
 * Projetos com codes que nao estao no localStorage sao "novos".
 * Na primeira vez, salva todos os codes atuais como vistos (nada e novo).
 */

const SEEN_KEY = (userId) => `portfolio_seen_projects_${userId}`;

export function getSeenProjectCodes(userId) {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(SEEN_KEY(userId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markProjectSeen(userId, projectCode) {
  if (!userId || !projectCode) return;
  const seen = getSeenProjectCodes(userId);
  seen.add(String(projectCode));
  localStorage.setItem(SEEN_KEY(userId), JSON.stringify([...seen]));
}

/**
 * Inicializa projetos vistos e retorna Set dos novos.
 * Primeira vez (key nao existe): salva TODOS como vistos, retorna Set vazio.
 * Vezes seguintes: retorna codes que nao estao no Set salvo.
 */
export function initSeenProjects(userId, allCodes) {
  if (!userId) return new Set();
  const key = SEEN_KEY(userId);
  const raw = localStorage.getItem(key);

  if (raw === null) {
    // Primeira vez - salvar todos como vistos
    localStorage.setItem(key, JSON.stringify(allCodes.map(String)));
    return new Set();
  }

  const seen = new Set(JSON.parse(raw));
  const newCodes = new Set();
  for (const code of allCodes) {
    if (!seen.has(String(code))) {
      newCodes.add(String(code));
    }
  }
  return newCodes;
}

export function pruneSeenCodes(userId, existingCodes) {
  if (!userId) return;
  const seen = getSeenProjectCodes(userId);
  const existingSet = new Set(existingCodes.map(String));
  const pruned = new Set([...seen].filter(code => existingSet.has(code)));
  if (pruned.size !== seen.size) {
    localStorage.setItem(SEEN_KEY(userId), JSON.stringify([...pruned]));
  }
}
