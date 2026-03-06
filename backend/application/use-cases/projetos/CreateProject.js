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

    // 2. Check duplicidade (nome + empresa)
    const projectName = input.name.trim().toUpperCase();
    const existing = await this.#projetoRepository.findProjectByNameAndCompany(projectName, input.companyId);
    if (existing) {
      throw new Error(`Já existe um projeto "${projectName}" para este cliente (ID: ${existing.id})`);
    }

    // 3. Gerar código automático de 9 dígitos: XXXYYYZZZ
    const [clientCode, projectCount, maxOrder] = await Promise.all([
      this.#projetoRepository.getOrAssignClientCode(input.companyId),
      this.#projetoRepository.countProjectsByCompany(input.companyId),
      this.#projetoRepository.getMaxProjectOrder(),
    ]);

    const xxx = maxOrder + 1;                          // project_order (global)
    const yyy = clientCode;                            // client_code
    const zzz = projectCount + 1;                      // nth project of this client

    const projectCode = String(xxx).padStart(3, '0')
      + String(yyy).padStart(3, '0')
      + String(zzz).padStart(3, '0');

    // 4. Criar entidade (validação via Value Objects no construtor)
    const project = Project.create({
      ...input,
      projectCode,
      projectOrder: xxx,
      clienteDisciplineId,
    });

    // 5. Persistir em todas as tabelas
    const savedData = await this.#projetoRepository.saveProject(project);

    // 6. Retornar resposta
    return {
      id: savedData.id,
      project_code: savedData.project_code || projectCode,
      project_order: xxx,
      name: savedData.name,
      status: savedData.status,
    };
  }
}

export { CreateProject };
