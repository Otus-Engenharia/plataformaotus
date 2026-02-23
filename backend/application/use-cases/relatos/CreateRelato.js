/**
 * Use Case: Criar Relato
 */

import { Relato } from '../../../domain/relatos/entities/Relato.js';

class CreateRelato {
  #relatoRepository;

  constructor(relatoRepository) {
    this.#relatoRepository = relatoRepository;
  }

  async execute({ projectCode, tipo, prioridade, titulo, descricao, authorId, authorName }) {
    // Valida tipo contra DB
    const tipos = await this.#relatoRepository.findAllTipos();
    const tipoValid = tipos.find(t => t.slug === tipo);
    if (!tipoValid) {
      throw new Error(`Tipo inválido: "${tipo}". Valores válidos: ${tipos.map(t => t.slug).join(', ')}`);
    }

    // Valida prioridade contra DB
    const prioridades = await this.#relatoRepository.findAllPrioridades();
    const prioridadeValid = prioridades.find(p => p.slug === prioridade);
    if (!prioridadeValid) {
      throw new Error(`Prioridade inválida: "${prioridade}". Valores válidos: ${prioridades.map(p => p.slug).join(', ')}`);
    }

    const relato = Relato.create({ projectCode, tipo, prioridade, titulo, descricao, authorId, authorName });
    const saved = await this.#relatoRepository.save(relato);

    return saved.toResponse(tipoValid, prioridadeValid);
  }
}

export { CreateRelato };
