/**
 * Rastreamento de feedbacks vistos pelo admin via localStorage.
 * Armazena IDs dos feedbacks que o admin já abriu.
 */

const SEEN_KEY = (userId) => `feedbacks_admin_seen_${userId}`;

export function getSeenFeedbackIds(userId) {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(SEEN_KEY(userId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markFeedbackSeen(userId, feedbackId) {
  if (!userId) return;
  const seen = getSeenFeedbackIds(userId);
  seen.add(String(feedbackId));
  localStorage.setItem(SEEN_KEY(userId), JSON.stringify([...seen]));
}

export function markAllFeedbacksSeen(userId, feedbackIds) {
  if (!userId) return;
  const seen = getSeenFeedbackIds(userId);
  feedbackIds.forEach(id => seen.add(String(id)));
  localStorage.setItem(SEEN_KEY(userId), JSON.stringify([...seen]));
}

export function pruneSeenIds(userId, existingIds) {
  if (!userId) return;
  const seen = getSeenFeedbackIds(userId);
  const existingSet = new Set(existingIds.map(String));
  const pruned = new Set([...seen].filter(id => existingSet.has(id)));
  if (pruned.size !== seen.size) {
    localStorage.setItem(SEEN_KEY(userId), JSON.stringify([...pruned]));
  }
  return pruned;
}
