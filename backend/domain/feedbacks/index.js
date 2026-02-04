/**
 * Domínio: Feedbacks
 *
 * Exporta todas as entidades, value objects e interfaces do domínio.
 */

// Entidades
export { Feedback } from './entities/index.js';

// Value Objects
export {
  FeedbackStatus,
  FeedbackStatusEnum,
  FeedbackType,
  FeedbackTypeEnum,
} from './value-objects/index.js';

// Interface do Repositório
export { FeedbackRepository } from './FeedbackRepository.js';
