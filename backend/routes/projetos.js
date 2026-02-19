/**
 * Rotas: Projetos (DDD)
 * Endpoints do Formulário de Passagem
 */

import express from 'express';
import { SupabaseProjetoRepository } from '../infrastructure/repositories/SupabaseProjetoRepository.js';
import {
  CreateProject,
  CreateClient,
  CreateContact,
  ListClients,
  ListContactsByCompany,
  ListServices,
} from '../application/use-cases/projetos/index.js';
import { TipologiaEmpreendimento } from '../domain/projetos/value-objects/TipologiaEmpreendimento.js';
import { PadraoAcabamento } from '../domain/projetos/value-objects/PadraoAcabamento.js';
import { TipoServicoProjeto } from '../domain/projetos/value-objects/TipoServicoProjeto.js';
import { TipoPagamento } from '../domain/projetos/value-objects/TipoPagamento.js';
import { PlataformaComunicacao } from '../domain/projetos/value-objects/PlataformaComunicacao.js';
import { PlataformaACD } from '../domain/projetos/value-objects/PlataformaACD.js';

const router = express.Router();
let projetoRepository = null;

function getRepository() {
  if (!projetoRepository) {
    projetoRepository = new SupabaseProjetoRepository();
  }
  return projetoRepository;
}

function createRoutes(requireAuth, canAccessFormularioPassagem, logAction) {
  const repository = getRepository();

  // Middleware de permissão do formulário
  function requireFormAccess(req, res, next) {
    if (!canAccessFormularioPassagem(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado ao formulário de passagem',
      });
    }
    next();
  }

  /**
   * GET /api/projetos/form/clients
   * Dropdown de clientes (companies com company_type='client')
   */
  router.get('/form/clients', requireAuth, requireFormAccess, async (req, res) => {
    try {
      const listClients = new ListClients(repository);
      const clients = await listClients.execute();
      res.json({ success: true, data: clients });
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/projetos/form/clients
   * Cria um novo cliente (company)
   */
  router.post('/form/clients', requireAuth, requireFormAccess, async (req, res) => {
    try {
      const { name, company_address, maturidade_cliente, nivel_cliente } = req.body;
      const createClient = new CreateClient(repository);
      const client = await createClient.execute({ name, company_address, maturidade_cliente, nivel_cliente });
      res.status(201).json({ success: true, data: client });
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/projetos/form/contacts/:companyId
   * Dropdown de contatos filtrado por empresa
   */
  router.get('/form/contacts/:companyId', requireAuth, requireFormAccess, async (req, res) => {
    try {
      const { companyId } = req.params;
      const listContacts = new ListContactsByCompany(repository);
      const contacts = await listContacts.execute(companyId);
      res.json({ success: true, data: contacts });
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/projetos/form/contacts
   * Cria um novo contato vinculado a uma empresa
   */
  router.post('/form/contacts', requireAuth, requireFormAccess, async (req, res) => {
    try {
      const { name, email, phone, position, company_id } = req.body;
      const createContact = new CreateContact(repository);
      const contact = await createContact.execute({ name, email, phone, position, company_id });
      res.status(201).json({ success: true, data: contact });
    } catch (error) {
      console.error('Erro ao criar contato:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/projetos/form/services
   * Dropdown de entregáveis (serviços disponíveis)
   */
  router.get('/form/services', requireAuth, requireFormAccess, async (req, res) => {
    try {
      const listServices = new ListServices(repository);
      const services = await listServices.execute();
      res.json({ success: true, data: services });
    } catch (error) {
      console.error('Erro ao buscar serviços:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/projetos/form/options
   * Retorna as opções dos Value Objects para popular dropdowns no frontend
   */
  router.get('/form/options', requireAuth, requireFormAccess, async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          tipologia_empreendimento: TipologiaEmpreendimento.allOptions(),
          padrao_acabamento: PadraoAcabamento.allOptions(),
          tipo_servico: TipoServicoProjeto.allOptions(),
          tipo_pagamento: TipoPagamento.allOptions(),
          plataforma_comunicacao: PlataformaComunicacao.allOptions(),
          plataforma_acd: PlataformaACD.allOptions(),
          responsavel_plataforma: [
            { value: 'Cliente', label: 'Cliente' },
            { value: 'Otus', label: 'Otus' },
          ],
          responsavel_acd: [
            { value: 'Cliente', label: 'Cliente' },
            { value: 'Otus', label: 'Otus' },
          ],
        },
      });
    } catch (error) {
      console.error('Erro ao buscar opções:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/projetos/form/submit
   * Submissão do Formulário de Passagem — cria projeto em múltiplas tabelas
   */
  router.post('/form/submit', requireAuth, requireFormAccess, async (req, res) => {
    try {
      const {
        // Etapa 1: Cliente
        company_id,
        // Etapa 2: Projeto
        name, description, address, contact_ids,
        area_construida, area_efetiva,
        numero_unidades, numero_torres, numero_pavimentos,
        tipologia_empreendimento, padrao_acabamento,
        // Etapa 3: Negócio
        data_venda, complexidade, complexidade_projetista,
        complexidade_tecnica, service_type, tipo_pagamento,
        responsavel_plataforma_comunicacao, responsavel_acd,
        link_contrato_ger, link_escopo_descritivo, link_proposta_ger,
        fase_entrada, vgv_empreendimento,
        service_ids, plataforma_comunicacao, plataforma_acd,
      } = req.body;

      // Validação de campos obrigatórios
      if (!company_id) {
        return res.status(400).json({ success: false, error: 'Cliente é obrigatório' });
      }
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Nome do projeto é obrigatório' });
      }

      // Validação de Value Objects (quando preenchidos)
      if (tipologia_empreendimento && !TipologiaEmpreendimento.isValid(tipologia_empreendimento)) {
        return res.status(400).json({
          success: false,
          error: `Tipologia inválida. Valores: ${TipologiaEmpreendimento.VALID_VALUES.join(', ')}`,
        });
      }
      if (padrao_acabamento && !PadraoAcabamento.isValid(padrao_acabamento)) {
        return res.status(400).json({
          success: false,
          error: `Padrão de acabamento inválido. Valores: ${PadraoAcabamento.VALID_VALUES.join(', ')}`,
        });
      }
      if (service_type && !TipoServicoProjeto.isValid(service_type)) {
        return res.status(400).json({
          success: false,
          error: `Tipo de serviço inválido. Valores: ${TipoServicoProjeto.VALID_VALUES.join(', ')}`,
        });
      }
      if (tipo_pagamento && !TipoPagamento.isValid(tipo_pagamento)) {
        return res.status(400).json({
          success: false,
          error: `Tipo de pagamento inválido. Valores: ${TipoPagamento.VALID_VALUES.join(', ')}`,
        });
      }
      if (plataforma_comunicacao && !PlataformaComunicacao.isValid(plataforma_comunicacao)) {
        return res.status(400).json({
          success: false,
          error: `Plataforma de comunicação inválida. Valores: ${PlataformaComunicacao.VALID_VALUES.join(', ')}`,
        });
      }
      if (plataforma_acd && !PlataformaACD.isValid(plataforma_acd)) {
        return res.status(400).json({
          success: false,
          error: `Plataforma ACD inválida. Valores: ${PlataformaACD.VALID_VALUES.join(', ')}`,
        });
      }

      const createProject = new CreateProject(repository);
      const result = await createProject.execute({
        companyId: company_id,
        name: name.toUpperCase(),
        description: description || null,
        address: address || null,
        contactIds: contact_ids || [],
        areaConstruida: area_construida || null,
        areaEfetiva: area_efetiva || null,
        numeroUnidades: numero_unidades || null,
        numeroTorres: numero_torres || null,
        numeroPavimentos: numero_pavimentos || null,
        tipologiaEmpreendimento: tipologia_empreendimento || null,
        padraoAcabamento: padrao_acabamento || null,
        dataVenda: data_venda || null,
        complexidade: complexidade || null,
        complexidadeProjetista: complexidade_projetista || null,
        complexidadeTecnica: complexidade_tecnica || null,
        serviceType: service_type || null,
        tipoPagamento: tipo_pagamento || null,
        responsavelPlataformaComunicacao: responsavel_plataforma_comunicacao || null,
        responsavelACD: responsavel_acd || null,
        linkContratoGer: link_contrato_ger || null,
        linkEscopoDescritivo: link_escopo_descritivo || null,
        linkPropostaGer: link_proposta_ger || null,
        faseEntrada: fase_entrada || null,
        vgvEmpreendimento: vgv_empreendimento || null,
        serviceIds: service_ids || [],
        plataformaComunicacao: plataforma_comunicacao || null,
        plataformaACD: plataforma_acd || null,
      });

      if (logAction) {
        await logAction(req, 'create', 'project', result.id,
          'Projeto criado via Formulário de Passagem',
          { name: result.name }
        );
      }

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao criar projeto:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao criar projeto',
      });
    }
  });

  return router;
}

export { createRoutes };
export default router;
