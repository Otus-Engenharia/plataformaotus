/**
 * Interface: BaselineRepository
 * Contrato para persistência de Baselines (Supabase + BigQuery).
 */

class BaselineRepository {
  // --- Supabase (metadados) ---

  async findByProjectCode(projectCode) {
    throw new Error('Not implemented: findByProjectCode');
  }

  async findById(id) {
    throw new Error('Not implemented: findById');
  }

  async getNextRevisionNumber(projectCode) {
    throw new Error('Not implemented: getNextRevisionNumber');
  }

  async save(baseline) {
    throw new Error('Not implemented: save');
  }

  async update(baseline) {
    throw new Error('Not implemented: update');
  }

  async delete(id) {
    throw new Error('Not implemented: delete');
  }

  // --- BigQuery (snapshots de tarefas) ---

  async saveTaskSnapshots(baselineId, projectCode, snapshotDate, tasks) {
    throw new Error('Not implemented: saveTaskSnapshots');
  }

  async getTaskSnapshots(baselineId) {
    throw new Error('Not implemented: getTaskSnapshots');
  }

  async deleteTaskSnapshots(baselineId) {
    throw new Error('Not implemented: deleteTaskSnapshots');
  }
}

export { BaselineRepository };
