/**
 * Use Case: CheckProjectReadiness
 *
 * Verifica se um projeto tem todos os dados necessários para gerar o relatório semanal.
 * Retorna um objeto com os checks individuais e um status geral de prontidão.
 */

class CheckProjectReadiness {
  #bigqueryClient;

  constructor(bigqueryClient) {
    this.#bigqueryClient = bigqueryClient;
  }

  /**
   * @param {Object} params
   * @param {string} params.construflowId - ID do Construflow do projeto
   * @param {string} params.smartsheetId - ID do Smartsheet do projeto
   * @param {string} params.driveFolderId - ID da pasta no Google Drive
   * @param {string[]} params.clientEmails - Emails do cliente configurados
   * @param {string[]} params.teamEmails - Emails da equipe configurados
   * @returns {Promise<Object>} resultado dos checks de prontidão
   */
  async execute({ construflowId, smartsheetId, driveFolderId, clientEmails, teamEmails }) {
    const checks = {
      construflow: { ready: false, count: 0, message: '' },
      smartsheet: { ready: false, count: 0, message: '' },
      driveFolder: { ready: false, message: '' },
      clientEmails: { ready: false, count: 0, message: '' },
      teamEmails: { ready: false, count: 0, message: '' },
    };

    // Check 1: Dados do Construflow no BigQuery
    if (construflowId) {
      try {
        const result = await this.#bigqueryClient.checkWeeklyReportReadiness(construflowId, null);
        checks.construflow.ready = result.construflow.ready;
        checks.construflow.count = result.construflow.count;
        checks.construflow.message = result.construflow.ready
          ? `${result.construflow.count} issues encontradas`
          : 'Nenhuma issue encontrada no Construflow';
      } catch (err) {
        checks.construflow.message = `Erro ao verificar Construflow: ${err.message}`;
      }
    } else {
      checks.construflow.message = 'Construflow ID não configurado';
    }

    // Check 2: Dados do Smartsheet no BigQuery
    if (smartsheetId) {
      try {
        const result = await this.#bigqueryClient.checkWeeklyReportReadiness(null, smartsheetId);
        checks.smartsheet.ready = result.smartsheet.ready;
        checks.smartsheet.count = result.smartsheet.count;
        checks.smartsheet.message = result.smartsheet.ready
          ? `${result.smartsheet.count} tarefas encontradas`
          : 'Nenhuma tarefa encontrada no Smartsheet';
      } catch (err) {
        checks.smartsheet.message = `Erro ao verificar Smartsheet: ${err.message}`;
      }
    } else {
      // Smartsheet é opcional
      checks.smartsheet.ready = true;
      checks.smartsheet.message = 'Smartsheet não configurado (opcional)';
    }

    // Check 3: Pasta no Google Drive
    checks.driveFolder.ready = !!driveFolderId;
    checks.driveFolder.message = driveFolderId
      ? 'Pasta configurada'
      : 'Pasta do Drive não configurada';

    // Check 4: Emails do cliente
    const validClientEmails = (clientEmails || []).filter(e => e && e.includes('@'));
    checks.clientEmails.ready = validClientEmails.length > 0;
    checks.clientEmails.count = validClientEmails.length;
    checks.clientEmails.message = validClientEmails.length > 0
      ? `${validClientEmails.length} email(s) configurado(s)`
      : 'Nenhum email do cliente configurado';

    // Check 5: Emails da equipe
    const validTeamEmails = (teamEmails || []).filter(e => e && e.includes('@'));
    checks.teamEmails.ready = validTeamEmails.length > 0;
    checks.teamEmails.count = validTeamEmails.length;
    checks.teamEmails.message = validTeamEmails.length > 0
      ? `${validTeamEmails.length} email(s) configurado(s)`
      : 'Nenhum email da equipe configurado';

    // Requisitos mínimos: Construflow + Drive (Smartsheet é opcional, emails são para Gmail)
    const ready = checks.construflow.ready && checks.driveFolder.ready;

    return {
      ready,
      checks,
    };
  }
}

export { CheckProjectReadiness };
