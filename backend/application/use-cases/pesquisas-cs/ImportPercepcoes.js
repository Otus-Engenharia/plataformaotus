/**
 * Use Case: ImportPercepcoes
 * Importa múltiplas percepções (do CSV). Usa upsert para evitar duplicatas.
 */

import { PercepcaoEquipe } from '../../../domain/pesquisas-cs/entities/PercepcaoEquipe.js';

class ImportPercepcoes {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * @param {Array<Object>} records - array de objetos com campos da percepção
   * @returns {{ imported: number, errors: Array<{ index: number, error: string }> }}
   */
  async execute(records) {
    const valid = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      try {
        const r = records[i];
        const percepcao = PercepcaoEquipe.create({
          projetoCodigo: r.projeto_codigo,
          mes: r.mes_referencia,
          ano: r.ano_referencia,
          respondenteEmail: r.respondente_email,
          respondenteNome: r.respondente_nome || null,
          cronograma: r.cronograma ?? null,
          qualidade: r.qualidade,
          comunicacao: r.comunicacao,
          custos: r.custos,
          parceria: r.parceria,
          confianca: r.confianca,
          oportunidadeRevenda: r.oportunidade_revenda ?? null,
          comentarios: r.comentarios || null,
        });
        valid.push(percepcao);
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }

    let imported = 0;
    if (valid.length > 0) {
      const saved = await this.#repository.saveMany(valid);
      imported = saved.length;
    }

    return { imported, errors };
  }
}

export { ImportPercepcoes };
