// Paleta de cores para curvas de snapshots (do mais antigo ao mais recente)
const SNAPSHOT_COLORS = [
  '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB',
  '#1D4ED8', '#1E40AF', '#1E3A8A', '#0EA5E9',
];

function getSnapshotColor(index, total) {
  if (total <= SNAPSHOT_COLORS.length) {
    const step = SNAPSHOT_COLORS.length / total;
    return SNAPSHOT_COLORS[Math.min(Math.floor(index * step), SNAPSHOT_COLORS.length - 1)];
  }
  return SNAPSHOT_COLORS[index % SNAPSHOT_COLORS.length];
}

export { SNAPSHOT_COLORS, getSnapshotColor };
