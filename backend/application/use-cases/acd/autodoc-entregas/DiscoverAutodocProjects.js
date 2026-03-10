/**
 * Use Case: DiscoverAutodocProjects
 * Crawl todas as contas Autodoc para descobrir projetos e sugerir matches.
 */

class DiscoverAutodocProjects {
  #repository;
  #autodocClient;

  constructor(repository, autodocClient) {
    this.#repository = repository;
    this.#autodocClient = autodocClient;
  }

  async execute({ portfolioProjectCodes = [] }) {
    // 1. Descobrir todos os projetos Autodoc
    const { projects: allProjects, diagnostics } = await this.#autodocClient.discoverAllProjects();

    // 2. Buscar mapeamentos existentes
    const existingMappings = await this.#repository.getProjectMappings({ activeOnly: false });
    const mappedKeys = new Set(
      existingMappings.map(m => `${m.autodoc_customer_id}::${m.autodoc_project_folder_id}`)
    );
    const mappedToCode = new Map(
      existingMappings.map(m => [`${m.autodoc_customer_id}::${m.autodoc_project_folder_id}`, m.portfolio_project_code])
    );

    // 3. Para cada projeto, calcular sugestao
    const results = allProjects.map(project => {
      const key = `${project.customerId}::${project.projectFolderId}`;
      const alreadyMapped = mappedKeys.has(key);
      const mappedCode = mappedToCode.get(key);

      let suggestedMatch = null;
      if (!alreadyMapped && portfolioProjectCodes.length > 0) {
        suggestedMatch = this.#findBestMatch(project.projectName, portfolioProjectCodes);
      }

      return {
        customerId: project.customerId,
        customerName: project.customerName,
        projectFolderId: project.projectFolderId,
        projectName: project.projectName,
        autodocProduct: project.autodocProduct || null,
        useClassicApi: project.useClassicApi || false,
        classicInstanceId: project.classicInstanceId || null,
        alreadyMapped,
        mappedProjectCode: mappedCode || null,
        suggestedMatch,
      };
    });

    return { results, diagnostics };
  }

  #findBestMatch(projectName, projectCodes) {
    const normalized = projectName.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;

    for (const code of projectCodes) {
      const codeNorm = code.toLowerCase().trim();

      // Exact contains
      if (normalized.includes(codeNorm) || codeNorm.includes(normalized)) {
        const score = 90;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { projectCode: code, confidence: score };
        }
        continue;
      }

      // Levenshtein-based similarity
      const similarity = this.#similarity(normalized, codeNorm);
      const score = Math.round(similarity * 100);

      if (score > bestScore && score >= 40) {
        bestScore = score;
        bestMatch = { projectCode: code, confidence: score };
      }
    }

    return bestMatch;
  }

  #similarity(a, b) {
    if (a === b) return 1;
    if (!a.length || !b.length) return 0;

    // Jaccard similarity on trigrams
    const trigramsA = this.#trigrams(a);
    const trigramsB = this.#trigrams(b);

    if (trigramsA.size === 0 || trigramsB.size === 0) return 0;

    let intersection = 0;
    for (const t of trigramsA) {
      if (trigramsB.has(t)) intersection++;
    }

    const union = trigramsA.size + trigramsB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  #trigrams(str) {
    const set = new Set();
    const padded = `  ${str} `;
    for (let i = 0; i < padded.length - 2; i++) {
      set.add(padded.substring(i, i + 3));
    }
    return set;
  }
}

export { DiscoverAutodocProjects };
