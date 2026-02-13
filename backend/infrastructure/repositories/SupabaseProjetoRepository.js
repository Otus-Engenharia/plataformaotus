/**
 * Implementação Supabase do ProjetoRepository
 * Persiste projetos criados via Formulário de Passagem
 */

import { ProjetoRepository } from '../../domain/projetos/ProjetoRepository.js';
import { getSupabaseServiceClient } from '../../supabase.js';

const PROJECTS_TABLE = 'projects';
const COMERCIAL_INFO_TABLE = 'project_comercial_infos';
const FEATURES_TABLE = 'project_features';
const PROJECT_SERVICES_TABLE = 'project_services';
const DISCIPLINES_TABLE = 'project_disciplines';
const COMPANIES_TABLE = 'companies';
const CONTACTS_TABLE = 'contacts';
const STANDARD_DISCIPLINES_TABLE = 'standard_disciplines';
const SERVICES_TABLE = 'services';

class SupabaseProjetoRepository extends ProjetoRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseServiceClient();
  }

  async saveProject(project) {
    const persistence = project.toPersistence();

    // 1. Inserir na tabela projects (obrigatório)
    const { data: projectData, error: projectError } = await this.#supabase
      .from(PROJECTS_TABLE)
      .insert(persistence.project)
      .select()
      .single();

    if (projectError) {
      throw new Error(`Erro ao criar projeto: ${projectError.message}`);
    }

    const projectId = projectData.id;

    // 2. Inserir informações comerciais
    const { error: comercialError } = await this.#supabase
      .from(COMERCIAL_INFO_TABLE)
      .insert({
        project_id: projectId,
        ...persistence.comercialInfo,
      });

    if (comercialError) {
      console.error('Erro ao inserir info comercial:', comercialError);
    }

    // 3. Upsert project_features (plataformas)
    const { error: featuresError } = await this.#supabase
      .from(FEATURES_TABLE)
      .upsert(
        {
          project_id: projectId,
          ...persistence.features,
        },
        { onConflict: 'project_id' }
      );

    if (featuresError) {
      console.error('Erro ao inserir features:', featuresError);
    }

    // 4. Inserir serviços do projeto (bulk)
    if (persistence.serviceIds.length > 0) {
      const serviceRows = persistence.serviceIds.map(serviceId => ({
        project_id: projectId,
        service_id: serviceId,
        status: 'ativo',
      }));

      const { error: servicesError } = await this.#supabase
        .from(PROJECT_SERVICES_TABLE)
        .insert(serviceRows);

      if (servicesError) {
        console.error('Erro ao inserir serviços:', servicesError);
      }
    }

    // 5. Inserir contatos como disciplina "Cliente"
    const { contactIds, companyId, clienteDisciplineId } = persistence.contacts;
    if (contactIds.length > 0 && clienteDisciplineId) {
      const disciplineRows = contactIds.map(contactId => ({
        project_id: projectId,
        discipline_id: clienteDisciplineId,
        company_id: companyId,
        contact_id: contactId,
        status: 'ativo',
      }));

      const { error: disciplinesError } = await this.#supabase
        .from(DISCIPLINES_TABLE)
        .insert(disciplineRows);

      if (disciplinesError) {
        console.error('Erro ao inserir disciplinas (contatos):', disciplinesError);
      }
    }

    return { id: projectId, ...projectData };
  }

  async findClients() {
    const { data, error } = await this.#supabase
      .from(COMPANIES_TABLE)
      .select('id, name, company_type, status')
      .eq('company_type', 'client')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar clientes: ${error.message}`);
    }

    return data || [];
  }

  async findContactsByCompany(companyId) {
    const { data, error } = await this.#supabase
      .from(CONTACTS_TABLE)
      .select('id, name, email, phone, position, company_id')
      .eq('company_id', companyId)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar contatos: ${error.message}`);
    }

    return data || [];
  }

  async findServices() {
    const { data, error } = await this.#supabase
      .from(SERVICES_TABLE)
      .select('id, name, status')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar serviços: ${error.message}`);
    }

    return data || [];
  }

  async findClienteDisciplineId() {
    const { data, error } = await this.#supabase
      .from(STANDARD_DISCIPLINES_TABLE)
      .select('id')
      .eq('discipline_name', 'Cliente')
      .single();

    if (error) {
      throw new Error(`Erro ao buscar disciplina Cliente: ${error.message}`);
    }

    return data?.id || null;
  }

  async saveClient({ name, company_address, maturidade_cliente, nivel_cliente }) {
    const { data, error } = await this.#supabase
      .from(COMPANIES_TABLE)
      .insert({
        name,
        company_address,
        maturidade_cliente,
        nivel_cliente,
        company_type: 'client',
        status: 'validado',
      })
      .select('id, name')
      .single();

    if (error) {
      throw new Error(`Erro ao criar cliente: ${error.message}`);
    }

    return data;
  }

  async saveContact({ name, email, phone, position, company_id }) {
    const { data, error } = await this.#supabase
      .from(CONTACTS_TABLE)
      .insert({ name, email, phone, position, company_id })
      .select('id, name, position')
      .single();

    if (error) {
      throw new Error(`Erro ao criar contato: ${error.message}`);
    }

    return data;
  }
}

export { SupabaseProjetoRepository };
