/**
 * Interface: IfcChangeLogRepository
 *
 * Contrato para persistência de snapshots e logs de mudança IFC.
 * A implementação concreta fica na camada de infraestrutura.
 */

class IfcChangeLogRepository {
  // --- Snapshots ---

  async findSnapshotsByProject(projectCode) {
    throw new Error('Método findSnapshotsByProject deve ser implementado');
  }

  async upsertSnapshots(snapshots) {
    throw new Error('Método upsertSnapshots deve ser implementado');
  }

  async updateSnapshot(snapshot) {
    throw new Error('Método updateSnapshot deve ser implementado');
  }

  // --- Change Logs ---

  async saveChangeLogs(changeLogs) {
    throw new Error('Método saveChangeLogs deve ser implementado');
  }

  async findChangeLogsByProject(projectCode, options = {}) {
    throw new Error('Método findChangeLogsByProject deve ser implementado');
  }

  async findRecentChangeLogs(options = {}) {
    throw new Error('Método findRecentChangeLogs deve ser implementado');
  }

  // --- Project Features (read-only) ---

  async findProjectsWithIfcLinks() {
    throw new Error('Método findProjectsWithIfcLinks deve ser implementado');
  }
}

export { IfcChangeLogRepository };
