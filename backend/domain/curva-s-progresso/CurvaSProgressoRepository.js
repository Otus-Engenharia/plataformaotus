/**
 * Interface: CurvaSProgressoRepository
 *
 * Define o contrato para persistência de configurações de pesos da Curva S.
 * A implementação concreta fica na camada de infraestrutura.
 */

class CurvaSProgressoRepository {
  // --- Defaults ---

  async findDefaultPhaseWeights() {
    throw new Error('Método findDefaultPhaseWeights deve ser implementado');
  }

  async findDefaultDisciplineWeights() {
    throw new Error('Método findDefaultDisciplineWeights deve ser implementado');
  }

  async findDefaultActivityWeights() {
    throw new Error('Método findDefaultActivityWeights deve ser implementado');
  }

  async saveDefaultPhaseWeights(weights) {
    throw new Error('Método saveDefaultPhaseWeights deve ser implementado');
  }

  async saveDefaultDisciplineWeights(weights) {
    throw new Error('Método saveDefaultDisciplineWeights deve ser implementado');
  }

  async saveDefaultActivityWeights(weights) {
    throw new Error('Método saveDefaultActivityWeights deve ser implementado');
  }

  // --- Project Overrides ---

  async findProjectOverrides(projectCode) {
    throw new Error('Método findProjectOverrides deve ser implementado');
  }

  async saveProjectOverrides(projectCode, overrides) {
    throw new Error('Método saveProjectOverrides deve ser implementado');
  }

  async deleteProjectOverrides(projectCode) {
    throw new Error('Método deleteProjectOverrides deve ser implementado');
  }
}

export { CurvaSProgressoRepository };
