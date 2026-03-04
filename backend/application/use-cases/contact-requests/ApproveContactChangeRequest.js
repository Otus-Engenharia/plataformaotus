/**
 * Use Case: ApproveContactChangeRequest
 * Equipe de dados aprova a solicitação e aplica a alteração no banco.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safeUuid(value) {
  return value && UUID_RE.test(String(value)) ? String(value) : null;
}

class ApproveContactChangeRequest {
  #repository;
  #contactService;

  constructor(repository, contactService) {
    this.#repository = repository;
    this.#contactService = contactService;
  }

  async execute({ requestId, reviewerId, reviewerEmail, reviewerName }) {
    const request = await this.#repository.findById(requestId);
    if (!request) {
      throw new Error('Solicitação não encontrada');
    }

    let resultContactId = null;
    let resultCompanyId = null;

    const type = request.requestType.value;
    const payload = request.payload;

    if (type === 'novo_contato') {
      const contact = await this.#contactService.createContact({
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        position: payload.position,
        companyId: payload.company_id,
      });
      resultContactId = safeUuid(contact.id);
    } else if (type === 'editar_contato') {
      const newValues = payload.new_values || payload;
      await this.#contactService.updateContact(request.targetContactId, newValues);
      resultContactId = safeUuid(request.targetContactId);
    } else if (type === 'nova_empresa') {
      const company = await this.#contactService.createCompany({
        name: payload.name,
        companyType: payload.company_type,
      });
      resultCompanyId = safeUuid(company.id);
    } else if (type === 'nova_disciplina') {
      await this.#contactService.createStandardDiscipline({
        name: payload.name,
      });
    }

    request.approve(reviewerId, reviewerEmail, reviewerName, resultContactId, resultCompanyId);

    const updated = await this.#repository.update(request);
    return {
      request: updated.toResponse(),
      resultContactId,
      resultCompanyId,
    };
  }
}

export { ApproveContactChangeRequest };
