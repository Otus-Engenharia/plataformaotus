/**
 * Use Case: ScanProjectFolder
 * Escaneia uma pasta IFC do Google Drive e detecta mudanças.
 */

import { GoogleDriveFileScanner } from '../../../infrastructure/services/GoogleDriveFileScanner.js';
import { FileChangeDetector } from '../../../domain/ifc-changelog/services/FileChangeDetector.js';

class ScanProjectFolder {
  #repository;
  #driveScanner;

  constructor(repository, driveScanner) {
    this.#repository = repository;
    this.#driveScanner = driveScanner;
  }

  async execute({ projectCode, driveFolderUrl, scannedBy }) {
    // 1. Extrair folder ID da URL
    const folderId = GoogleDriveFileScanner.extractFolderId(driveFolderUrl);
    if (!folderId) {
      throw new Error(`URL do Drive inválida: ${driveFolderUrl}`);
    }

    // 2. Verificar acesso à pasta
    const verification = await this.#driveScanner.verifyFolder(folderId);
    if (!verification.accessible) {
      return {
        projectCode,
        success: false,
        error: `Pasta inacessível: ${verification.error}`,
        changesDetected: 0,
      };
    }

    // 3. Listar arquivos atuais do Drive
    const currentFiles = await this.#driveScanner.listFiles(folderId);

    // 4. Buscar snapshots anteriores
    const existingSnapshots = await this.#repository.findSnapshotsByProject(projectCode);

    // 5. Detectar mudanças (lógica de domínio)
    const { changeLogs, updatedSnapshots, newSnapshots } =
      FileChangeDetector.detect(currentFiles, existingSnapshots, projectCode, folderId, scannedBy);

    // 6. Persistir resultados
    if (newSnapshots.length > 0) {
      await this.#repository.upsertSnapshots(newSnapshots);
    }
    for (const snap of updatedSnapshots) {
      await this.#repository.updateSnapshot(snap);
    }
    if (changeLogs.length > 0) {
      await this.#repository.saveChangeLogs(changeLogs);
    }

    // 7. Retornar resumo
    return {
      projectCode,
      success: true,
      folderName: verification.name,
      totalFiles: currentFiles.length,
      changesDetected: changeLogs.length,
      changes: changeLogs.map(cl => cl.toResponse()),
    };
  }
}

export { ScanProjectFolder };
