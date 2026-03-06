/**
 * Módulo de integração com Discord Webhooks
 * Envia notificações formatadas para canais Discord
 */

// Logo e nome do bot
const BOT_NAME = 'Plataforma Otus';
const BOT_AVATAR = 'https://app.otusengenharia.com/Otus-logo-300x300.png';

// Configuração por TIPO DE EVENTO
const EVENT_CONFIG = {
  'projeto_iniciou': {
    title: '🚀  PROJETO INICIADO',
    color: 0x27ae60
  },
  'avanco_fase': {
    title: '📈  AVANÇO DE FASE',
    color: 0x3498db
  },
  'projeto_pausou': {
    title: '⏸️  PROJETO PAUSADO',
    color: 0xf39c12
  },
  'projeto_retomou': {
    title: '▶️  PROJETO RETOMADO',
    color: 0x2ecc71
  },
  'projeto_finalizando': {
    title: '📋  TERMO DE ENCERRAMENTO',
    color: 0x95a5a6
  },
  'projeto_finalizado': {
    title: '✅  PROJETO FINALIZADO',
    color: 0x7f8c8d
  },
  'churn': {
    title: '❌  PROJETO CANCELADO',
    color: 0xe74c3c
  },
  'projeto_criado': {
    title: '📋  NOVO PROJETO CRIADO',
    color: 0x9b59b6
  },
  'default': {
    title: '🔄  MUDANÇA DE STATUS',
    color: 0xD4A017
  }
};

/**
 * Determina o tipo de evento baseado na transição de status
 */
function getEventType(oldStatus, newStatus) {
  const old = (oldStatus || '').toLowerCase().trim();
  const newS = (newStatus || '').toLowerCase().trim();

  // Churn/Cancelamento
  if (newS.includes('churn') || newS.includes('cancelado')) return 'churn';

  // Projeto iniciou
  if (old === 'a iniciar' && newS === 'planejamento') return 'projeto_iniciou';

  // Projeto pausou
  if (!old.includes('pausado') && newS.includes('pausado')) return 'projeto_pausou';

  // Projeto retomou
  if (old.includes('pausado') && !newS.includes('pausado')) return 'projeto_retomou';

  // Termo de encerramento
  if (newS === 'termo de encerramento') return 'projeto_finalizando';

  // Close/Finalizado
  if (newS === 'close' || newS === 'execução') return 'projeto_finalizado';

  // Avanço de fase (fase 01 → 02 → 03 → 04)
  const faseRegex = /fase\s*(\d+)/;
  const oldFase = old.match(faseRegex);
  const newFase = newS.match(faseRegex);
  if (oldFase && newFase && parseInt(newFase[1]) > parseInt(oldFase[1])) {
    return 'avanco_fase';
  }

  return 'default';
}

/**
 * Retorna a configuração do evento (título e cor)
 */
function getEventConfig(oldStatus, newStatus) {
  const eventType = getEventType(oldStatus, newStatus);
  return EVENT_CONFIG[eventType] || EVENT_CONFIG.default;
}


/**
 * Envia notificação de mudança de status para o Discord
 * @param {Object} params - Parâmetros da notificação
 * @param {string} params.projectCode - Código do projeto
 * @param {string} params.projectName - Nome do projeto
 * @param {string} params.oldStatus - Status anterior
 * @param {string} params.newStatus - Novo status
 * @param {string} params.userName - Nome do usuário que fez a alteração
 * @param {string} params.userPicture - URL da foto do usuário
 * @param {string[]} params.webhookUrls - URLs dos webhooks Discord
 * @returns {Promise<PromiseSettledResult[]>} Resultados das requisições
 */
async function sendStatusChangeNotification({
  projectCode,
  projectName,
  oldStatus,
  newStatus,
  userName,
  userPicture,
  webhookUrls = []
}) {
  // Configuração do evento (título e cor dinâmicos)
  const eventConfig = getEventConfig(oldStatus, newStatus);

  // Estrutura do embed - formato maior e mais claro
  const embed = {
    title: eventConfig.title,
    description: `**${userName || 'Usuário'}** atualizou o status de um projeto`,
    color: eventConfig.color,
    fields: [
      {
        name: '━━━━━━━━━━━━━━━━━━━━━━',
        value: '\u200B',
        inline: false
      },
      {
        name: '📁  PROJETO',
        value: `\`\`\`${projectCode}\`\`\``,
        inline: true
      },
      {
        name: '📝  NOME',
        value: `\`\`\`${projectName || 'N/A'}\`\`\``,
        inline: true
      },
      {
        name: '\u200B',
        value: '\u200B',
        inline: false
      },
      {
        name: '⬅️  STATUS ANTERIOR',
        value: `\`\`\`diff\n- ${oldStatus || 'N/A'}\`\`\``,
        inline: true
      },
      {
        name: '➡️  NOVO STATUS',
        value: `\`\`\`diff\n+ ${newStatus || 'N/A'}\`\`\``,
        inline: true
      }
    ],
    footer: {
      text: '🏗️ Plataforma Otus • Portfolio de Projetos',
      icon_url: 'https://app.otusengenharia.com/favicon.ico'
    },
    timestamp: new Date().toISOString()
  };

  // Payload do webhook
  const payload = {
    username: BOT_NAME,
    avatar_url: BOT_AVATAR,
    embeds: [embed]
  };

  // Filtra URLs válidas
  const validUrls = webhookUrls.filter(Boolean);

  if (validUrls.length === 0) {
    console.warn('Discord: Nenhuma URL de webhook configurada');
    return [];
  }

  // Envia para todos os webhooks configurados
  const results = await Promise.allSettled(
    validUrls.map(url =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    )
  );

  // Log de resultados
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.ok) {
      console.log(`✅ Discord: Notificação enviada com sucesso (webhook ${index + 1})`);
    } else {
      console.error(`❌ Discord: Falha ao enviar notificação (webhook ${index + 1}):`,
        result.reason || result.value?.statusText);
    }
  });

  return results;
}

/**
 * Verifica se deve notificar o canal Financeiro
 * Eventos financeiros: início, finalização, pausa, retomada, churn
 * @param {string} oldStatus - Status anterior
 * @param {string} newStatus - Novo status
 * @returns {boolean} True se deve notificar o Financeiro
 */
function shouldNotifyFinanceiro(oldStatus, newStatus) {
  const old = (oldStatus || '').toLowerCase().trim();
  const newS = (newStatus || '').toLowerCase().trim();

  // 1. Projeto iniciou: a iniciar → planejamento
  if (old === 'a iniciar' && newS === 'planejamento') return true;

  // 2. Projeto finalizando: fase 04 → termo de encerramento
  if (old === 'fase 04' && newS === 'termo de encerramento') return true;

  // 3. Projeto pausou: qualquer fase → pausado
  if (!old.includes('pausado') && newS.includes('pausado')) return true;

  // 4. Projeto retomou: pausado → qualquer fase (não pausado)
  if (old.includes('pausado') && !newS.includes('pausado')) return true;

  // 5. Cancelamento/Churn
  if (newS.includes('churn')) return true;

  return false;
}

/**
 * Retorna as URLs de webhook configuradas para notificações de projetos
 * - Projetos, CS e Digital: recebem TODAS as mudanças
 * - Financeiro: recebe apenas eventos financeiros específicos
 * @param {string} oldStatus - Status anterior
 * @param {string} newStatus - Novo status
 * @returns {string[]} Array de URLs de webhook
 */
function getWebhookUrls(oldStatus, newStatus) {
  const urls = [
    process.env.DISCORD_WEBHOOK_URL_PROJETOS,
    process.env.DISCORD_WEBHOOK_URL_CS,
    process.env.DISCORD_WEBHOOK_URL_DIGITAL
  ];

  // Adiciona Financeiro apenas para eventos específicos
  if (shouldNotifyFinanceiro(oldStatus, newStatus)) {
    urls.push(process.env.DISCORD_WEBHOOK_URL_FINANCEIRO);
  }

  return urls.filter(Boolean);
}

/**
 * Retorna URLs de webhook para notificação de criação de projeto
 * Envia para TODOS os canais: Projetos, CS, Digital e Financeiro
 * @returns {string[]} Array de URLs de webhook
 */
function getProjectCreatedWebhookUrls() {
  return [
    process.env.DISCORD_WEBHOOK_URL_PROJETOS,
    process.env.DISCORD_WEBHOOK_URL_CS,
    process.env.DISCORD_WEBHOOK_URL_DIGITAL,
    process.env.DISCORD_WEBHOOK_URL_FINANCEIRO
  ].filter(Boolean);
}

/**
 * Envia notificação de criação de projeto para o Discord
 * @param {Object} params - Parâmetros da notificação
 * @param {string} params.projectName - Nome do projeto
 * @param {string} params.companyName - Nome da empresa/cliente
 * @param {string} params.userName - Nome do usuário que criou
 * @param {string} [params.serviceType] - Tipo de serviço
 * @param {string} [params.faseEntrada] - Fase de entrada
 * @returns {Promise<PromiseSettledResult[]>} Resultados das requisições
 */
async function sendProjectCreatedNotification({
  projectCode,
  projectName,
  companyName,
  userName,
  serviceType,
  faseEntrada
}) {
  const eventConfig = EVENT_CONFIG['projeto_criado'];

  const fields = [
    {
      name: '━━━━━━━━━━━━━━━━━━━━━━',
      value: '\u200B',
      inline: false
    },
    {
      name: '🔢  CÓDIGO',
      value: `\`\`\`${projectCode || 'N/A'}\`\`\``,
      inline: true
    },
    {
      name: '📁  PROJETO',
      value: `\`\`\`${projectName || 'N/A'}\`\`\``,
      inline: true
    },
    {
      name: '🏢  CLIENTE',
      value: `\`\`\`${companyName || 'N/A'}\`\`\``,
      inline: false
    }
  ];

  if (serviceType || faseEntrada) {
    fields.push({ name: '\u200B', value: '\u200B', inline: false });
    if (serviceType) {
      fields.push({
        name: '🔧  TIPO DE SERVIÇO',
        value: `\`\`\`${serviceType}\`\`\``,
        inline: true
      });
    }
    if (faseEntrada) {
      fields.push({
        name: '📌  FASE DE ENTRADA',
        value: `\`\`\`${faseEntrada}\`\`\``,
        inline: true
      });
    }
  }

  const embed = {
    title: eventConfig.title,
    description: `**${userName || 'Usuário'}** criou um novo projeto via Formulário de Passagem`,
    color: eventConfig.color,
    fields,
    footer: {
      text: '🏗️ Plataforma Otus • Formulário de Passagem',
      icon_url: 'https://app.otusengenharia.com/favicon.ico'
    },
    timestamp: new Date().toISOString()
  };

  const payload = {
    username: BOT_NAME,
    avatar_url: BOT_AVATAR,
    embeds: [embed]
  };

  const webhookUrls = getProjectCreatedWebhookUrls();

  if (webhookUrls.length === 0) {
    console.warn('Discord: Nenhuma URL de webhook configurada para criação de projeto');
    return [];
  }

  const results = await Promise.allSettled(
    webhookUrls.map(url =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    )
  );

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.ok) {
      console.log(`✅ Discord: Notificação de novo projeto enviada (webhook ${index + 1})`);
    } else {
      console.error(`❌ Discord: Falha ao enviar notificação de novo projeto (webhook ${index + 1}):`,
        result.reason || result.value?.statusText);
    }
  });

  return results;
}

export {
  sendStatusChangeNotification,
  getWebhookUrls,
  getEventConfig,
  getEventType,
  sendProjectCreatedNotification,
  getProjectCreatedWebhookUrls,
  EVENT_CONFIG
};
