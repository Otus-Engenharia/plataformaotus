/**
 * Entidade: Project (Aggregate Root)
 * Domínio: Gestão de Projetos
 *
 * Representa um projeto criado via Formulário de Passagem.
 * Agrega dados de: projects, project_comercial_infos,
 * project_features, project_services, project_disciplines.
 */

import { TipologiaEmpreendimento } from '../value-objects/TipologiaEmpreendimento.js';
import { PadraoAcabamento } from '../value-objects/PadraoAcabamento.js';
import { TipoServicoProjeto } from '../value-objects/TipoServicoProjeto.js';
import { TipoPagamento } from '../value-objects/TipoPagamento.js';
import { PlataformaComunicacao } from '../value-objects/PlataformaComunicacao.js';
import { PlataformaACD } from '../value-objects/PlataformaACD.js';

class Project {
  // --- projects table ---
  #id;
  #name;
  #companyId;
  #description;
  #address;
  #areaConstruida;
  #areaEfetiva;
  #numeroUnidades;
  #numeroTorres;
  #numeroPavimentos;
  #tipologiaEmpreendimento;
  #padraoAcabamento;
  #serviceType;
  #status;
  #createdAt;

  // --- project_comercial_infos ---
  #dataVenda;
  #complexidade;
  #complexidadeProjetista;
  #complexidadeTecnica;
  #tipoPagamento;
  #responsavelPlataformaComunicacao;
  #responsavelACD;
  #linkContratoGer;
  #linkEscopoDescritivo;
  #linkPropostaGer;
  #faseEntrada;
  #vgvEmpreendimento;

  // --- project_features ---
  #plataformaComunicacao;
  #plataformaACD;

  // --- relações N:N ---
  #serviceIds;
  #contactIds;
  #clienteDisciplineId;

  constructor({
    id = null,
    name,
    companyId,
    description = null,
    address = null,
    areaConstruida = null,
    areaEfetiva = null,
    numeroUnidades = null,
    numeroTorres = null,
    numeroPavimentos = null,
    tipologiaEmpreendimento = null,
    padraoAcabamento = null,
    serviceType = null,
    status = 'passagem_vendas',
    createdAt = null,
    dataVenda = null,
    complexidade = null,
    complexidadeProjetista = null,
    complexidadeTecnica = null,
    tipoPagamento = null,
    responsavelPlataformaComunicacao = null,
    responsavelACD = null,
    linkContratoGer = null,
    linkEscopoDescritivo = null,
    linkPropostaGer = null,
    faseEntrada = null,
    vgvEmpreendimento = null,
    plataformaComunicacao = null,
    plataformaACD = null,
    serviceIds = [],
    contactIds = [],
    clienteDisciplineId = null,
  }) {
    // Validações obrigatórias
    if (!name || name.trim().length === 0) {
      throw new Error('O nome do projeto é obrigatório');
    }
    if (!companyId) {
      throw new Error('O cliente (company_id) é obrigatório');
    }

    // --- projects ---
    this.#id = id;
    this.#name = name.trim().toUpperCase();
    this.#companyId = companyId;
    this.#description = description?.trim() || null;
    this.#address = address?.trim() || null;
    this.#areaConstruida = areaConstruida != null ? parseFloat(areaConstruida) : null;
    this.#areaEfetiva = areaEfetiva != null ? parseFloat(areaEfetiva) : null;
    this.#numeroUnidades = numeroUnidades != null ? parseInt(numeroUnidades, 10) : null;
    this.#numeroTorres = numeroTorres != null ? parseInt(numeroTorres, 10) : null;
    this.#numeroPavimentos = numeroPavimentos != null ? parseInt(numeroPavimentos, 10) : null;
    this.#status = status;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();

    // Value Objects (opcionais — só instancia se valor não-nulo)
    this.#tipologiaEmpreendimento = tipologiaEmpreendimento
      ? (tipologiaEmpreendimento instanceof TipologiaEmpreendimento
        ? tipologiaEmpreendimento
        : new TipologiaEmpreendimento(tipologiaEmpreendimento))
      : null;

    this.#padraoAcabamento = padraoAcabamento
      ? (padraoAcabamento instanceof PadraoAcabamento
        ? padraoAcabamento
        : new PadraoAcabamento(padraoAcabamento))
      : null;

    this.#serviceType = serviceType
      ? (serviceType instanceof TipoServicoProjeto
        ? serviceType
        : new TipoServicoProjeto(serviceType))
      : null;

    // --- project_comercial_infos ---
    this.#dataVenda = dataVenda || null;
    this.#complexidade = complexidade?.trim() || null;
    this.#complexidadeProjetista = complexidadeProjetista?.trim() || null;
    this.#complexidadeTecnica = complexidadeTecnica?.trim() || null;

    this.#tipoPagamento = tipoPagamento
      ? (tipoPagamento instanceof TipoPagamento
        ? tipoPagamento
        : new TipoPagamento(tipoPagamento))
      : null;

    this.#responsavelPlataformaComunicacao = responsavelPlataformaComunicacao?.trim() || null;
    this.#responsavelACD = responsavelACD?.trim() || null;
    this.#linkContratoGer = linkContratoGer?.trim() || null;
    this.#linkEscopoDescritivo = linkEscopoDescritivo?.trim() || null;
    this.#linkPropostaGer = linkPropostaGer?.trim() || null;
    this.#faseEntrada = faseEntrada?.trim() || null;
    this.#vgvEmpreendimento = vgvEmpreendimento?.trim() || null;

    // --- project_features ---
    this.#plataformaComunicacao = plataformaComunicacao
      ? (plataformaComunicacao instanceof PlataformaComunicacao
        ? plataformaComunicacao
        : new PlataformaComunicacao(plataformaComunicacao))
      : null;

    this.#plataformaACD = plataformaACD
      ? (plataformaACD instanceof PlataformaACD
        ? plataformaACD
        : new PlataformaACD(plataformaACD))
      : null;

    // --- relações ---
    this.#serviceIds = Array.isArray(serviceIds) ? serviceIds : [];
    this.#contactIds = Array.isArray(contactIds) ? contactIds : [];
    this.#clienteDisciplineId = clienteDisciplineId;
  }

  // ---- Getters ----

  get id() { return this.#id; }
  get name() { return this.#name; }
  get companyId() { return this.#companyId; }
  get description() { return this.#description; }
  get address() { return this.#address; }
  get areaConstruida() { return this.#areaConstruida; }
  get areaEfetiva() { return this.#areaEfetiva; }
  get numeroUnidades() { return this.#numeroUnidades; }
  get numeroTorres() { return this.#numeroTorres; }
  get numeroPavimentos() { return this.#numeroPavimentos; }
  get tipologiaEmpreendimento() { return this.#tipologiaEmpreendimento; }
  get padraoAcabamento() { return this.#padraoAcabamento; }
  get serviceType() { return this.#serviceType; }
  get status() { return this.#status; }
  get createdAt() { return this.#createdAt; }
  get dataVenda() { return this.#dataVenda; }
  get tipoPagamento() { return this.#tipoPagamento; }
  get plataformaComunicacao() { return this.#plataformaComunicacao; }
  get plataformaACD() { return this.#plataformaACD; }
  get serviceIds() { return this.#serviceIds; }
  get contactIds() { return this.#contactIds; }

  // ---- Computed ----

  get code() {
    return this.#id ? `PJ-${this.#id}` : null;
  }

  // ---- Persistence ----

  /**
   * Retorna objeto composto para persistência em múltiplas tabelas.
   * O repositório decompõe esse objeto nos inserts apropriados.
   */
  toPersistence() {
    return {
      project: {
        name: this.#name,
        company_id: this.#companyId,
        description: this.#description,
        address: this.#address,
        area_construida: this.#areaConstruida,
        area_efetiva: this.#areaEfetiva,
        numero_unidades: this.#numeroUnidades,
        numero_torres: this.#numeroTorres,
        numero_pavimentos: this.#numeroPavimentos,
        tipologia_empreendimento: this.#tipologiaEmpreendimento?.value || null,
        padrao_acabamento: this.#padraoAcabamento?.value || null,
        service_type: this.#serviceType?.value || null,
        status: this.#status,
      },
      comercialInfo: {
        data_venda: this.#dataVenda,
        complexidade: this.#complexidade,
        complexidade_projetista: this.#complexidadeProjetista,
        complexidade_tecnica: this.#complexidadeTecnica,
        tipo_pagamento: this.#tipoPagamento?.value || null,
        resposavel_plataforma_comunicacao: this.#responsavelPlataformaComunicacao,
        responsavel_acd: this.#responsavelACD,
        link_contrato_ger: this.#linkContratoGer,
        link_escopo_descritivo: this.#linkEscopoDescritivo,
        link_proposta_ger: this.#linkPropostaGer,
        fase_entrada: this.#faseEntrada,
        vgv_empreendimento: this.#vgvEmpreendimento,
      },
      features: {
        plataforma_comunicacao: this.#plataformaComunicacao?.value || null,
        plataforma_acd: this.#plataformaACD?.value || null,
      },
      serviceIds: this.#serviceIds,
      contacts: {
        contactIds: this.#contactIds,
        companyId: this.#companyId,
        clienteDisciplineId: this.#clienteDisciplineId,
      },
    };
  }

  toResponse() {
    return {
      id: this.#id,
      code: this.code,
      name: this.#name,
      company_id: this.#companyId,
      description: this.#description,
      address: this.#address,
      area_construida: this.#areaConstruida,
      area_efetiva: this.#areaEfetiva,
      numero_unidades: this.#numeroUnidades,
      numero_torres: this.#numeroTorres,
      numero_pavimentos: this.#numeroPavimentos,
      tipologia_empreendimento: this.#tipologiaEmpreendimento?.value || null,
      padrao_acabamento: this.#padraoAcabamento?.value || null,
      service_type: this.#serviceType?.value || null,
      status: this.#status,
      data_venda: this.#dataVenda,
      complexidade: this.#complexidade,
      complexidade_projetista: this.#complexidadeProjetista,
      complexidade_tecnica: this.#complexidadeTecnica,
      tipo_pagamento: this.#tipoPagamento?.value || null,
      responsavel_plataforma_comunicacao: this.#responsavelPlataformaComunicacao,
      responsavel_acd: this.#responsavelACD,
      link_contrato_ger: this.#linkContratoGer,
      link_escopo_descritivo: this.#linkEscopoDescritivo,
      link_proposta_ger: this.#linkPropostaGer,
      fase_entrada: this.#faseEntrada,
      vgv_empreendimento: this.#vgvEmpreendimento,
      plataforma_comunicacao: this.#plataformaComunicacao?.value || null,
      plataforma_acd: this.#plataformaACD?.value || null,
      created_at: this.#createdAt?.toISOString(),
    };
  }

  // ---- Factories ----

  static create(params) {
    return new Project({
      ...params,
      status: 'passagem_vendas',
    });
  }

  static fromPersistence(data) {
    return new Project({
      id: data.id,
      name: data.name,
      companyId: data.company_id,
      description: data.description,
      address: data.address,
      areaConstruida: data.area_construida,
      areaEfetiva: data.area_efetiva,
      numeroUnidades: data.numero_unidades,
      numeroTorres: data.numero_torres,
      numeroPavimentos: data.numero_pavimentos,
      tipologiaEmpreendimento: data.tipologia_empreendimento,
      padraoAcabamento: data.padrao_acabamento,
      serviceType: data.service_type,
      status: data.status,
      createdAt: data.created_at,
      dataVenda: data.data_venda,
      complexidade: data.complexidade,
      complexidadeProjetista: data.complexidade_projetista,
      complexidadeTecnica: data.complexidade_tecnica,
      tipoPagamento: data.tipo_pagamento,
      responsavelPlataformaComunicacao: data.resposavel_plataforma_comunicacao,
      responsavelACD: data.responsavel_acd,
      linkContratoGer: data.link_contrato_ger,
      linkEscopoDescritivo: data.link_escopo_descritivo,
      linkPropostaGer: data.link_proposta_ger,
      faseEntrada: data.fase_entrada,
      vgvEmpreendimento: data.vgv_empreendimento,
      plataformaComunicacao: data.plataforma_comunicacao,
      plataformaACD: data.plataforma_acd,
    });
  }
}

export { Project };
