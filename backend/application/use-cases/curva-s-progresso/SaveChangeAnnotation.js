/**
 * Use Case: SaveChangeAnnotation
 * Cria ou atualiza uma anotação do coordenador sobre uma alteração
 * detectada entre snapshots mensais (upsert).
 */

import { ChangeAnnotation } from '../../../domain/curva-s-progresso/entities/ChangeAnnotation.js';

class SaveChangeAnnotation {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * @param {Object} params
   * @param {string} params.projectCode
   * @param {string} params.fromSnapshotDate
   * @param {string} params.toSnapshotDate
   * @param {string} params.changeType
   * @param {string} params.taskName
   * @param {string} [params.disciplina]
   * @param {string} [params.description]
   * @param {string} [params.justification]
   * @param {boolean} [params.isVisible]
   * @param {string} [params.userEmail]
   * @returns {Object} Annotation response
   */
  async execute({ projectCode, fromSnapshotDate, toSnapshotDate, changeType, taskName,
                  disciplina, description, justification, isVisible, userEmail,
                  overrideDeltaDays, overrideDataTermino }) {
    if (!projectCode) throw new Error('projectCode é obrigatório');
    if (!fromSnapshotDate) throw new Error('fromSnapshotDate é obrigatório');
    if (!toSnapshotDate) throw new Error('toSnapshotDate é obrigatório');
    if (!changeType) throw new Error('changeType é obrigatório');
    if (!taskName) throw new Error('taskName é obrigatório');

    const annotation = ChangeAnnotation.create({
      projectCode,
      fromSnapshotDate,
      toSnapshotDate,
      changeType,
      taskName,
      disciplina,
      description,
      justification,
      isVisible: isVisible !== undefined ? isVisible : true,
      createdByEmail: userEmail,
      overrideDeltaDays,
      overrideDataTermino,
    });

    const saved = await this.#repository.upsertAnnotation(annotation);
    return saved.toResponse();
  }
}

export { SaveChangeAnnotation };
