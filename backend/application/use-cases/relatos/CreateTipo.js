/**
 * Use Case: Criar Tipo de Relato (admin)
 */

class CreateTipo {
  #relatoRepository;

  constructor(relatoRepository) {
    this.#relatoRepository = relatoRepository;
  }

  async execute({ slug, label, color, icon, sortOrder }) {
    if (!slug || !label) {
      throw new Error('slug e label são obrigatórios');
    }

    return await this.#relatoRepository.saveTipo({
      slug: slug.toLowerCase().trim(),
      label: label.trim(),
      color: color || '#6B7280',
      icon: icon || null,
      sort_order: sortOrder || 0,
    });
  }
}

export { CreateTipo };
