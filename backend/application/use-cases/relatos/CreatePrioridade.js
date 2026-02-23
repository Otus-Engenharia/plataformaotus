/**
 * Use Case: Criar Prioridade de Relato (admin)
 */

class CreatePrioridade {
  #relatoRepository;

  constructor(relatoRepository) {
    this.#relatoRepository = relatoRepository;
  }

  async execute({ slug, label, color, sortOrder }) {
    if (!slug || !label) {
      throw new Error('slug e label são obrigatórios');
    }

    return await this.#relatoRepository.savePrioridade({
      slug: slug.toLowerCase().trim(),
      label: label.trim(),
      color: color || '#6B7280',
      sort_order: sortOrder || 0,
    });
  }
}

export { CreatePrioridade };
