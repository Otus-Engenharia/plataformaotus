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

    // 2. Gerar project_code a partir do nome (usado como identificador no portfolio)
    const projectCode = input.name.trim().toUpperCase();

    // 3. Criar entidade (validação via Value Objects no construtor)
    const project = Project.create({
      ...input,
      projectCode,
      clienteDisciplineId,
    });

    // 4. Persistir em todas as tabelas
    const savedData = await this.#projetoRepository.saveProject(project);

    // 5. Retornar resposta
    return {
      id: savedData.id,
      project_code: savedData.project_code || projectCode,
      name: savedData.name,
      status: savedData.status,
    };
  }
}

export { CreateProject };
