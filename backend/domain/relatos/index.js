/**
 * Domínio: Relatos (Diário de Projeto)
 *
 * Exporta todas as entidades, value objects e interfaces do domínio.
 */

// Entidades
export { Relato } from './entities/index.js';

// Value Objects
export { RelatoTipo } from './value-objects/index.js';
export { RelatoPrioridade } from './value-objects/index.js';

// Interface do Repositório
export { RelatoRepository } from './RelatoRepository.js';
