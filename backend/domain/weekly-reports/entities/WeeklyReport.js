/**
 * Entidade: WeeklyReport
 * Aggregate Root do domínio de Relatórios Semanais
 *
 * Representa um relatório semanal gerado para um projeto.
 */

import { ReportStatus } from '../value-objects/ReportStatus.js';
import { PipelineStep } from '../value-objects/PipelineStep.js';

class WeeklyReport {
  #id;
  #projectCode;
  #projectName;
  #weekNumber;
  #weekYear;
  #weekText;
  #generatedBy;
  #generatedAt;
  #status;
  #currentStep;
  #clientReportDriveUrl;
  #teamReportDriveUrl;
  #clientDraftUrl;
  #teamDraftUrl;
  #errorMessage;
  #metadata;
  #createdAt;

  constructor({
    id = null,
    projectCode,
    projectName,
    weekNumber,
    weekYear,
    weekText = null,
    generatedBy,
    generatedAt = null,
    status = 'in_progress',
    currentStep = null,
    clientReportDriveUrl = null,
    teamReportDriveUrl = null,
    clientDraftUrl = null,
    teamDraftUrl = null,
    errorMessage = null,
    metadata = null,
    createdAt = null,
  }) {
    if (!projectCode) throw new Error('O código do projeto é obrigatório');
    if (!projectName) throw new Error('O nome do projeto é obrigatório');
    if (!weekNumber || weekNumber < 1 || weekNumber > 53) throw new Error('Número da semana inválido (1-53)');
    if (!weekYear || weekYear < 2020) throw new Error('Ano inválido');
    if (!generatedBy) throw new Error('O autor da geração é obrigatório');

    this.#id = id;
    this.#projectCode = projectCode;
    this.#projectName = projectName;
    this.#weekNumber = weekNumber;
    this.#weekYear = weekYear;
    this.#weekText = weekText || WeeklyReport.#buildWeekText(weekNumber, weekYear);
    this.#generatedBy = generatedBy;
    this.#generatedAt = generatedAt ? new Date(generatedAt) : new Date();
    this.#status = status instanceof ReportStatus ? status : new ReportStatus(status);
    this.#currentStep = currentStep instanceof PipelineStep ? currentStep : new PipelineStep(currentStep);
    this.#clientReportDriveUrl = clientReportDriveUrl || null;
    this.#teamReportDriveUrl = teamReportDriveUrl || null;
    this.#clientDraftUrl = clientDraftUrl || null;
    this.#teamDraftUrl = teamDraftUrl || null;
    this.#errorMessage = errorMessage || null;
    this.#metadata = metadata || {};
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
  }

  // Getters
  get id() { return this.#id; }
  get projectCode() { return this.#projectCode; }
  get projectName() { return this.#projectName; }
  get weekNumber() { return this.#weekNumber; }
  get weekYear() { return this.#weekYear; }
  get weekText() { return this.#weekText; }
  get generatedBy() { return this.#generatedBy; }
  get generatedAt() { return this.#generatedAt; }
  get status() { return this.#status; }
  get currentStep() { return this.#currentStep; }
  get clientReportDriveUrl() { return this.#clientReportDriveUrl; }
  get teamReportDriveUrl() { return this.#teamReportDriveUrl; }
  get clientDraftUrl() { return this.#clientDraftUrl; }
  get teamDraftUrl() { return this.#teamDraftUrl; }
  get errorMessage() { return this.#errorMessage; }
  get metadata() { return this.#metadata; }
  get createdAt() { return this.#createdAt; }

  get isCompleted() { return this.#status.isCompleted; }
  get isFailed() { return this.#status.isFailed; }
  get isInProgress() { return this.#status.isInProgress; }

  get weekKey() {
    return `${this.#weekYear}-W${String(this.#weekNumber).padStart(2, '0')}`;
  }

  // --- Comportamentos do domínio ---

  /**
   * Avança para o próximo step do pipeline
   */
  advanceToStep(step) {
    if (this.#status.isDone) {
      throw new Error('Não é possível avançar um relatório já finalizado');
    }

    this.#currentStep = step instanceof PipelineStep ? step : new PipelineStep(step);
  }

  /**
   * Marca o relatório como concluído com os links gerados
   */
  complete({ clientReportDriveUrl, teamReportDriveUrl, clientDraftUrl, teamDraftUrl, metadata }) {
    if (this.#status.isDone) {
      throw new Error('Relatório já está finalizado');
    }

    this.#status = ReportStatus.completed();
    this.#currentStep = new PipelineStep(null);
    this.#clientReportDriveUrl = clientReportDriveUrl || null;
    this.#teamReportDriveUrl = teamReportDriveUrl || null;
    this.#clientDraftUrl = clientDraftUrl || null;
    this.#teamDraftUrl = teamDraftUrl || null;
    if (metadata) {
      this.#metadata = { ...this.#metadata, ...metadata };
    }
  }

  /**
   * Marca o relatório como falho
   */
  fail(errorMessage) {
    this.#status = ReportStatus.failed();
    this.#errorMessage = errorMessage;
  }

  /**
   * Converte para persistência (Supabase)
   */
  toPersistence() {
    return {
      id: this.#id,
      project_code: this.#projectCode,
      project_name: this.#projectName,
      week_number: this.#weekNumber,
      week_year: this.#weekYear,
      week_text: this.#weekText,
      generated_by: this.#generatedBy,
      generated_at: this.#generatedAt.toISOString(),
      status: this.#status.value,
      current_step: this.#currentStep.value,
      client_report_drive_url: this.#clientReportDriveUrl,
      team_report_drive_url: this.#teamReportDriveUrl,
      client_draft_url: this.#clientDraftUrl,
      team_draft_url: this.#teamDraftUrl,
      error_message: this.#errorMessage,
      metadata: this.#metadata,
      created_at: this.#createdAt.toISOString(),
    };
  }

  /**
   * Converte para resposta da API
   */
  toResponse() {
    return {
      id: this.#id,
      project_code: this.#projectCode,
      project_name: this.#projectName,
      week_number: this.#weekNumber,
      week_year: this.#weekYear,
      week_text: this.#weekText,
      week_key: this.weekKey,
      generated_by: this.#generatedBy,
      generated_at: this.#generatedAt.toISOString(),
      status: this.#status.value,
      status_label: this.#status.label,
      current_step: this.#currentStep.value,
      current_step_label: this.#currentStep.label,
      pipeline_steps: PipelineStep.ALL_STEPS_WITH_LABELS,
      client_report_drive_url: this.#clientReportDriveUrl,
      team_report_drive_url: this.#teamReportDriveUrl,
      client_draft_url: this.#clientDraftUrl,
      team_draft_url: this.#teamDraftUrl,
      error_message: this.#errorMessage,
      metadata: this.#metadata,
      created_at: this.#createdAt.toISOString(),
      is_completed: this.isCompleted,
      is_failed: this.isFailed,
      is_in_progress: this.isInProgress,
    };
  }

  /**
   * Factory: cria a partir de dados do Supabase
   */
  static fromPersistence(data) {
    return new WeeklyReport({
      id: data.id,
      projectCode: data.project_code,
      projectName: data.project_name,
      weekNumber: data.week_number,
      weekYear: data.week_year,
      weekText: data.week_text,
      generatedBy: data.generated_by,
      generatedAt: data.generated_at,
      status: data.status,
      currentStep: data.current_step,
      clientReportDriveUrl: data.client_report_drive_url,
      teamReportDriveUrl: data.team_report_drive_url,
      clientDraftUrl: data.client_draft_url,
      teamDraftUrl: data.team_draft_url,
      errorMessage: data.error_message,
      metadata: data.metadata,
      createdAt: data.created_at,
    });
  }

  /**
   * Factory: cria novo relatório para geração
   */
  static create({ projectCode, projectName, weekNumber, weekYear, generatedBy }) {
    return new WeeklyReport({
      projectCode,
      projectName,
      weekNumber,
      weekYear,
      generatedBy,
      status: 'in_progress',
      currentStep: 'fetching_data',
    });
  }

  /**
   * Calcula o texto da semana a partir do número ISO
   */
  static #buildWeekText(weekNumber, weekYear) {
    // Calcula a data de segunda-feira da semana ISO
    const jan4 = new Date(weekYear, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNumber - 1) * 7);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `Semana ${fmt(monday)} - ${fmt(friday)}`;
  }
}

export { WeeklyReport };
