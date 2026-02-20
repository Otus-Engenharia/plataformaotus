/**
 * Entidade: WeightConfiguration
 * Aggregate Root do domínio de Curva S Progresso
 *
 * Representa a configuração completa de pesos para cálculo da Curva S.
 * Gerencia 3 camadas: fases, disciplinas e etapas (atividades).
 */

import { PhaseWeight } from '../value-objects/PhaseWeight.js';
import { DisciplineWeight } from '../value-objects/DisciplineWeight.js';
import { ActivityWeight } from '../value-objects/ActivityWeight.js';

class WeightConfiguration {
  #phaseWeights;
  #disciplineWeights;
  #activityWeights;
  #projectCode;
  #isCustomized;

  constructor({
    phaseWeights = [],
    disciplineWeights = [],
    activityWeights = [],
    projectCode = null,
    isCustomized = false,
  }) {
    this.#phaseWeights = phaseWeights.map(pw =>
      pw instanceof PhaseWeight ? pw : PhaseWeight.fromPersistence(pw)
    );
    this.#disciplineWeights = disciplineWeights.map(dw =>
      dw instanceof DisciplineWeight ? dw : DisciplineWeight.fromPersistence(dw)
    );
    this.#activityWeights = activityWeights.map(aw =>
      aw instanceof ActivityWeight ? aw : ActivityWeight.fromPersistence(aw)
    );
    this.#projectCode = projectCode;
    this.#isCustomized = isCustomized;
  }

  // --- Getters ---

  get phaseWeights() { return [...this.#phaseWeights]; }
  get disciplineWeights() { return [...this.#disciplineWeights]; }
  get activityWeights() { return [...this.#activityWeights]; }
  get projectCode() { return this.#projectCode; }
  get isCustomized() { return this.#isCustomized; }

  get totalPhasePercent() {
    return this.#phaseWeights.reduce((sum, pw) => sum + pw.percent, 0);
  }

  get isPhaseWeightValid() {
    return Math.abs(this.totalPhasePercent - 100) < 0.01;
  }

  // --- Comportamentos do domínio ---

  /**
   * Busca o peso de uma fase pelo nome
   */
  getPhaseWeight(phaseName) {
    return this.#phaseWeights.find(pw => pw.phaseName === phaseName) || null;
  }

  /**
   * Busca o fator de peso de uma disciplina pelo nome
   * Retorna fator 1 (padrão) se disciplina não encontrada
   */
  getDisciplineFactor(disciplineName) {
    const dw = this.#disciplineWeights.find(dw => dw.disciplineName === disciplineName);
    return dw ? dw.factor : 1;
  }

  /**
   * Busca o fator de peso de uma etapa pelo tipo
   * Retorna fator 0 se etapa não reconhecida
   */
  getActivityFactor(activityType) {
    if (!activityType) return 0;
    const aw = this.#activityWeights.find(aw => aw.activityType === activityType);
    return aw ? aw.factor : 0;
  }

  /**
   * Valida que a configuração está completa e consistente
   */
  validate() {
    const errors = [];

    if (this.#phaseWeights.length === 0) {
      errors.push('Pelo menos uma fase é obrigatória');
    }

    if (!this.isPhaseWeightValid) {
      errors.push(`Pesos de fase devem somar 100%. Soma atual: ${this.totalPhasePercent.toFixed(2)}%`);
    }

    if (this.#disciplineWeights.length === 0) {
      errors.push('Pelo menos uma disciplina é obrigatória');
    }

    if (this.#activityWeights.length === 0) {
      errors.push('Pelo menos uma etapa/atividade é obrigatória');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Atualiza os pesos de fases
   */
  setPhaseWeights(phaseWeights) {
    this.#phaseWeights = phaseWeights.map(pw =>
      pw instanceof PhaseWeight ? pw : PhaseWeight.fromPersistence(pw)
    );
    this.#isCustomized = true;
  }

  /**
   * Atualiza os fatores de disciplinas
   */
  setDisciplineWeights(disciplineWeights) {
    this.#disciplineWeights = disciplineWeights.map(dw =>
      dw instanceof DisciplineWeight ? dw : DisciplineWeight.fromPersistence(dw)
    );
    this.#isCustomized = true;
  }

  /**
   * Atualiza os fatores de etapas
   */
  setActivityWeights(activityWeights) {
    this.#activityWeights = activityWeights.map(aw =>
      aw instanceof ActivityWeight ? aw : ActivityWeight.fromPersistence(aw)
    );
    this.#isCustomized = true;
  }

  /**
   * Converte para formato de resposta da API
   */
  toResponse() {
    return {
      project_code: this.#projectCode,
      is_customized: this.#isCustomized,
      phase_weights: this.#phaseWeights
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(pw => pw.toJSON()),
      discipline_weights: this.#disciplineWeights
        .sort((a, b) => b.factor - a.factor || a.disciplineName.localeCompare(b.disciplineName))
        .map(dw => dw.toJSON()),
      activity_weights: this.#activityWeights.map(aw => aw.toJSON()),
      total_phase_percent: this.totalPhasePercent,
      is_valid: this.isPhaseWeightValid,
    };
  }

  /**
   * Converte overrides para formato de persistência (JSONB para project_weight_overrides)
   */
  toOverridePersistence() {
    const phaseObj = {};
    for (const pw of this.#phaseWeights) {
      phaseObj[pw.phaseName] = pw.percent;
    }
    const discObj = {};
    for (const dw of this.#disciplineWeights) {
      discObj[dw.disciplineName] = dw.factor;
    }
    const actObj = {};
    for (const aw of this.#activityWeights) {
      actObj[aw.activityType] = aw.factor;
    }
    return {
      project_code: this.#projectCode,
      phase_weights: phaseObj,
      discipline_weights: discObj,
      activity_weights: actObj,
      is_customized: true,
    };
  }

  /**
   * Factory: cria configuração mesclando defaults com overrides de projeto
   */
  static mergeWithOverrides(defaults, overrides, projectCode) {
    if (!overrides || !overrides.is_customized) {
      return new WeightConfiguration({
        phaseWeights: defaults.phaseWeights,
        disciplineWeights: defaults.disciplineWeights,
        activityWeights: defaults.activityWeights,
        projectCode,
        isCustomized: false,
      });
    }

    // Override de fases
    let phaseWeights = defaults.phaseWeights;
    if (overrides.phase_weights && Object.keys(overrides.phase_weights).length > 0) {
      let sortOrder = 1;
      phaseWeights = Object.entries(overrides.phase_weights).map(([name, percent]) =>
        new PhaseWeight(name, percent, sortOrder++)
      );
    }

    // Override de disciplinas
    let disciplineWeights = defaults.disciplineWeights;
    if (overrides.discipline_weights && Object.keys(overrides.discipline_weights).length > 0) {
      disciplineWeights = Object.entries(overrides.discipline_weights).map(([name, factor]) =>
        new DisciplineWeight(name, factor)
      );
    }

    // Override de etapas
    let activityWeights = defaults.activityWeights;
    if (overrides.activity_weights && Object.keys(overrides.activity_weights).length > 0) {
      activityWeights = Object.entries(overrides.activity_weights).map(([type, factor]) =>
        new ActivityWeight(type, factor)
      );
    }

    return new WeightConfiguration({
      phaseWeights,
      disciplineWeights,
      activityWeights,
      projectCode,
      isCustomized: true,
    });
  }

  /**
   * Factory: cria a partir de dados de defaults do banco
   */
  static fromDefaults({ phases, disciplines, activities }) {
    return new WeightConfiguration({
      phaseWeights: (phases || []).map(p => PhaseWeight.fromPersistence(p)),
      disciplineWeights: (disciplines || []).map(d => DisciplineWeight.fromPersistence(d)),
      activityWeights: (activities || []).map(a => ActivityWeight.fromPersistence(a)),
      projectCode: null,
      isCustomized: false,
    });
  }
}

export { WeightConfiguration };
