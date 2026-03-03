/**
 * Interface: ContactChangeRequestRepository
 * Contrato para persistência de Solicitações de Alteração de Contato.
 */

class ContactChangeRequestRepository {
  async save(request) {
    throw new Error('Not implemented: save');
  }

  async findById(id) {
    throw new Error('Not implemented: findById');
  }

  async findPending() {
    throw new Error('Not implemented: findPending');
  }

  async findByRequester(email) {
    throw new Error('Not implemented: findByRequester');
  }

  async findByProjectCode(projectCode) {
    throw new Error('Not implemented: findByProjectCode');
  }

  async findAll({ status, requestType } = {}) {
    throw new Error('Not implemented: findAll');
  }

  async countPending() {
    throw new Error('Not implemented: countPending');
  }

  async update(request) {
    throw new Error('Not implemented: update');
  }
}

export { ContactChangeRequestRepository };
