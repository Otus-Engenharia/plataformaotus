/**
 * Use Case: Atualizar Prioridade de Relato (admin)
 */

class UpdatePrioridade {
  #relatoRepository;

  constructor(relatoRepository) {
    this.#relatoRepository = relatoRepository;
  }

  async execute({ id, label, color, sortOrder, isActive }) {
    const updateData = {};
    if (label !== undefined) updateData.label = label.trim();
    if (color !== undefined) updateData.color = color;
    if (sortOrder !== undefined) updateData.sort_order = sortOrder;
    if (isActive !== undefined) updateData.is_active = isActive;

    if (Object.keys(updateData).length === 0) {
      throw new Error('Nenhum campo para atualizar');
    }

    return await this.#relatoRepository.updatePrioridade(id, updateData);
  }
}

export { UpdatePrioridade };
