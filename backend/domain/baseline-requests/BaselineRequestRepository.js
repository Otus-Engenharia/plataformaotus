/**
 * Interface: BaselineRequestRepository
 * Contrato para persistência de Solicitações de Baseline (Supabase).
 */

class BaselineRequestRepository {
  async save(baselineRequest) {
    throw new Error('Not implemented: save');
  }

  async findById(id) {
    throw new Error('Not implemented: findById');
  }

  async findByProjectCode(projectCode) {
    throw new Error('Not implemented: findByProjectCode');
  }

  async findPending() {
    throw new Error('Not implemented: findPending');
  }

  async update(baselineRequest) {
    throw new Error('Not implemented: update');
  }
}

export { BaselineRequestRepository };
