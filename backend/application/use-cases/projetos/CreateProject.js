/**
 * Use Case: CreateProject
 * Cria um novo projeto via Formulário de Passagem.
 * Orquestra a criação em múltiplas tabelas.
 */

import { Project } from '../../../domain/projetos/entities/Project.js';

class CreateProject {
  #projetoRepository;

  constructor(projetoRepository) {
    this.#projetoRepository = projetoRepository;
  }

  async execute(input) {
    // 1. Buscar o ID da disciplina "Cliente" para project_disciplines
    const clienteDisciplineId = await this.#projetoRepository.findClienteDisciplineId();

    if (!clienteDisciplineId) {
      throw new Error('Disciplina "Cliente" não encontrada no sistema');
    }

    // 2. Criar entidade (validação via Value Objects no construtor)
    const project = Project.create({
      ...input,
      clienteDisciplineId,
    });

    // 3. Persistir em todas as tabelas
    const savedData = await this.#projetoRepository.saveProject(project);

    // 4. Retornar resposta
    return {
      id: savedData.id,
      name: savedData.name,
      status: savedData.status,
    };
  }
}

export { CreateProject };
