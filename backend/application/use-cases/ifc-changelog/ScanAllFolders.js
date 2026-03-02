/**
 * Use Case: ScanAllFolders
 * Escaneia todas as pastas IFC de todos os projetos.
 * Inclui delay entre projetos para respeitar rate limits do Drive API.
 */

import { ScanProjectFolder } from './ScanProjectFolder.js';

class ScanAllFolders {
  #repository;
  #driveScanner;

  constructor(repository, driveScanner) {
    this.#repository = repository;
    this.#driveScanner = driveScanner;
  }

  async execute({ scannedBy }) {
    const projects = await this.#repository.findProjectsWithIfcLinks();
    const results = [];

    for (const { projectCode, linkIfc } of projects) {
      try {
        const scanUseCase = new ScanProjectFolder(this.#repository, this.#driveScanner);
        const result = await scanUseCase.execute({
          projectCode,
          driveFolderUrl: linkIfc,
          scannedBy,
        });
        results.push(result);
      } catch (error) {
        results.push({
          projectCode,
          success: false,
          error: error.message,
          changesDetected: 0,
        });
      }

      // Rate limit: 500ms entre projetos
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
      totalProjects: projects.length,
      totalChanges: results.reduce((sum, r) => sum + r.changesDetected, 0),
      results,
    };
  }
}

export { ScanAllFolders };
