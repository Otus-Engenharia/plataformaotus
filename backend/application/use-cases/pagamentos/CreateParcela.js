import { Parcela } from '../../../domain/pagamentos/entities/Parcela.js';

class CreateParcela {
  #repository;
  #notificationService;

  constructor(repository, notificationService) {
    this.#repository = repository;
    this.#notificationService = notificationService;
  }

  async execute({ projectCode, projectId, companyId, parcelaNumero, descricao, valor, origem, fase, gerenteEmail, tipoServico, createdBy }) {
    const parcela = Parcela.create({
      projectCode,
      projectId,
      companyId,
      parcelaNumero,
      descricao,
      valor,
      origem,
      fase,
      gerenteEmail,
      tipoServico,
      createdBy,
    });

    const saved = await this.#repository.saveParcela(parcela);

    if (gerenteEmail && this.#notificationService) {
      this.#notificationService.notify(
        gerenteEmail,
        'parcela_criada',
        'Nova parcela criada',
        `Parcela ${parcelaNumero} do projeto ${projectCode} foi criada. Vincule ao cronograma.`,
        'parcela',
        saved.id,
        `/pagamentos?project=${projectCode}`
      ).catch(err => console.error('Erro ao notificar gerente:', err));
    }

    return saved.toResponse();
  }
}

export { CreateParcela };
