/**
 * Domain Service: FileChangeDetector
 *
 * Compara estado atual de arquivos do Drive com snapshots armazenados
 * e produz eventos de mudança categorizados.
 *
 * Lógica pura de domínio - sem dependências de infraestrutura.
 */

import { IfcFileName } from '../value-objects/IfcFileName.js';
import { IfcChangeLog } from '../entities/IfcChangeLog.js';

class FileChangeDetector {
  /**
   * Detecta mudanças comparando arquivos atuais com snapshots anteriores.
   *
   * @param {Array<Object>} currentFiles - Arquivos do Drive API
   * @param {Array<IfcFileSnapshot>} existingSnapshots - Snapshots do banco
   * @param {string} projectCode
   * @param {string} driveFolderId
   * @param {string} scannedBy - email de quem disparou o scan
   * @returns {{ changeLogs: IfcChangeLog[], updatedSnapshots: IfcFileSnapshot[], newSnapshots: Object[] }}
   */
  static detect(currentFiles, existingSnapshots, projectCode, driveFolderId, scannedBy) {
    const changeLogs = [];
    const updatedSnapshots = [];
    const newSnapshots = [];

    // Indexar snapshots existentes por driveFileId
    const existingByFileId = new Map(
      existingSnapshots.map(s => [s.driveFileId, s])
    );

    // Indexar por baseName+discipline para cross-file matching
    const existingByBase = new Map();
    for (const snap of existingSnapshots) {
      if (snap.isDeleted) continue;
      const key = `${snap.parsedBaseName}::${snap.parsedDiscipline || ''}`;
      if (!existingByBase.has(key)) existingByBase.set(key, []);
      existingByBase.get(key).push(snap);
    }

    for (const file of currentFiles) {
      const parsed = IfcFileName.parse(file.name);
      const existing = existingByFileId.get(file.id);

      if (existing) {
        // Arquivo já conhecido - atualizar lastSeenAt
        existing.markSeen();
        updatedSnapshots.push(existing);
      } else {
        // Novo drive_file_id - categorizar
        const baseKey = `${parsed.baseName}::${parsed.discipline || ''}`;
        const relatedSnapshots = existingByBase.get(baseKey) || [];

        if (relatedSnapshots.length === 0) {
          // Nenhum arquivo com mesmo baseName → novo arquivo
          changeLogs.push(IfcChangeLog.createNovoArquivo({
            projectCode, driveFolderId,
            fileName: file.name, driveFileId: file.id,
            parsedBaseName: parsed.baseName,
            fileSize: file.size,
            driveModifiedTime: file.modifiedTime,
            scannedBy,
          }));
        } else {
          // Tem arquivos relacionados - determinar tipo de mudança
          const latest = relatedSnapshots
            .sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt))[0];

          if (parsed.phase && latest.parsedPhase && parsed.phase !== latest.parsedPhase) {
            // Mudança de fase (EP → AP, PB → PE, etc.)
            changeLogs.push(IfcChangeLog.createMudancaFase({
              projectCode, driveFolderId,
              fileName: file.name, driveFileId: file.id,
              parsedBaseName: parsed.baseName,
              previousPhase: latest.parsedPhase,
              newPhase: parsed.phase,
              fileSize: file.size,
              driveModifiedTime: file.modifiedTime,
              scannedBy,
            }));
          } else if (parsed.revision && latest.parsedRevision && parsed.revision !== latest.parsedRevision) {
            // Nova revisão (R00 → R01, etc.)
            changeLogs.push(IfcChangeLog.createNovaRevisao({
              projectCode, driveFolderId,
              fileName: file.name, driveFileId: file.id,
              parsedBaseName: parsed.baseName,
              previousRevision: latest.parsedRevision,
              newRevision: parsed.revision,
              fileSize: file.size,
              driveModifiedTime: file.modifiedTime,
              scannedBy,
            }));
          } else {
            // Tem base similar mas não identifica mudança específica
            changeLogs.push(IfcChangeLog.createNovoArquivo({
              projectCode, driveFolderId,
              fileName: file.name, driveFileId: file.id,
              parsedBaseName: parsed.baseName,
              fileSize: file.size,
              driveModifiedTime: file.modifiedTime,
              scannedBy,
            }));
          }
        }

        // Criar snapshot para o novo arquivo
        newSnapshots.push({
          projectCode, driveFolderId,
          driveFileId: file.id,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.mimeType,
          md5Checksum: file.md5Checksum,
          driveCreatedTime: file.createdTime,
          driveModifiedTime: file.modifiedTime,
          parsedBaseName: parsed.baseName,
          parsedPhase: parsed.phase,
          parsedRevision: parsed.revision,
          parsedDiscipline: parsed.discipline,
        });
      }
    }

    // Marcar arquivos ausentes como deletados
    const currentFileIds = new Set(currentFiles.map(f => f.id));
    for (const snap of existingSnapshots) {
      if (!snap.isDeleted && !currentFileIds.has(snap.driveFileId)) {
        snap.markDeleted();
        updatedSnapshots.push(snap);
      }
    }

    return { changeLogs, updatedSnapshots, newSnapshots };
  }
}

export { FileChangeDetector };
