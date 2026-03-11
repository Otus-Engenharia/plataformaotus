/**
 * Domínio: Customer Success
 *
 * Exporta todas as entidades, value objects e interfaces do domínio.
 */

// Entidades
export { ClassificacaoCliente, PortfolioSnapshot } from './entities/index.js';

// Value Objects
export {
  Classificacao,
  ClassificacaoEnum,
  StatusProjeto,
  StatusProjetoEnum,
  StatusCliente,
  StatusClienteEnum,
} from './value-objects/index.js';

// Interface do Repositório
export { CustomerSuccessRepository } from './CustomerSuccessRepository.js';
