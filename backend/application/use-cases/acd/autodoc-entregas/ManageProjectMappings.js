/**
 * Use Case: ManageProjectMappings
 * CRUD para mapeamentos de projetos Autodoc.
 */

class ManageProjectMappings {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async list({ activeOnly = false } = {}) {
    return this.#repository.getProjectMappings({ activeOnly });
  }

  async upsert(mapping) {
    if (!mapping.portfolioProjectCode) throw new Error('portfolioProjectCode e obrigatorio');
    if (!mapping.autodocCustomerId) throw new Error('autodocCustomerId e obrigatorio');
    if (!mapping.autodocProjectFolderId) throw new Error('autodocProjectFolderId e obrigatorio');
    if (!mapping.autodocProjectName) throw new Error('autodocProjectName e obrigatorio');

    return this.#repository.upsertProjectMapping(mapping);
  }

  async delete(id) {
    if (!id) throw new Error('id e obrigatorio');
    return this.#repository.deleteProjectMapping(id);
  }
}

export { ManageProjectMappings };
