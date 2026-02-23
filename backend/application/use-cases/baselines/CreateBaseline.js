/**
 * Use Case: CreateBaseline
 * Cria uma nova baseline fazendo snapshot das tarefas atuais do projeto.
 *
 * Fluxo:
 * 1. Busca tarefas atuais do projeto no BigQuery
 * 2. Calcula próximo revision_number
 * 3. Cria registro de metadados no Supabase
 * 4. Salva snapshot das tarefas no BigQuery
 */

import { Baseline } from '../../../domain/baselines/entities/Baseline.js';
import { queryCurvaSProgressoTasks } from '../../../bigquery.js';

class CreateBaseline {
  #baselineRepository;

  constructor(baselineRepository) {
    this.#baselineRepository = baselineRepository;
  }

  async execute({ projectCode, smartsheetId, projectName, name, description, createdByEmail }) {
    if (!projectCode) {
      throw new Error('Código do projeto é obrigatório');
    }

    // 1. Buscar tarefas atuais do projeto no BigQuery
    const tasks = await queryCurvaSProgressoTasks(smartsheetId || projectCode, projectName);
    if (!tasks || tasks.length === 0) {
      throw new Error(`Nenhuma tarefa encontrada para o projeto ${projectCode}`);
    }

    // 2. Calcular próximo revision_number
    const revisionNumber = await this.#baselineRepository.getNextRevisionNumber(projectCode);

    // 3. Criar entidade baseline
    const autoName = name || (revisionNumber === 0
      ? 'Baseline Original'
      : `R${String(revisionNumber).padStart(2, '0')}`);

    const snapshotDate = new Date().toISOString().split('T')[0];

    const baseline = Baseline.create({
      projectCode,
      revisionNumber,
      name: autoName,
      description,
      createdByEmail,
      snapshotDate,
      source: 'platform',
    });

    baseline.setTaskCount(tasks.length);

    // 4. Salvar metadados no Supabase
    const savedBaseline = await this.#baselineRepository.save(baseline);

    // 5. Salvar snapshot das tarefas no BigQuery
    try {
      await this.#baselineRepository.saveTaskSnapshots(
        savedBaseline.id,
        projectCode,
        snapshotDate,
        tasks
      );
    } catch (err) {
      // Se falhar o snapshot, remove metadados para manter consistência
      console.error('Erro ao salvar snapshot, removendo baseline:', err.message);
      await this.#baselineRepository.delete(savedBaseline.id);
      throw new Error(`Erro ao salvar snapshot das tarefas: ${err.message}`);
    }

    return savedBaseline.toResponse();
  }
}

export { CreateBaseline };
