/**
 * Infrastructure Service: GoogleDriveFileScanner
 *
 * Wrapper do Google Drive API v3 para listar arquivos em pastas IFC.
 * Reutiliza o padrão de autenticação existente em weekly-report-generator.js.
 */

import { google } from 'googleapis';
import path from 'path';

class GoogleDriveFileScanner {
  #drive;

  async #ensureDrive() {
    if (this.#drive) return;

    const keyFile = path.resolve(
      process.cwd(),
      process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account-key.json'
    );

    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    this.#drive = google.drive({ version: 'v3', auth });
  }

  /**
   * Extrai folder ID de uma URL do Google Drive.
   * Suporta:
   * - https://drive.google.com/drive/folders/FOLDER_ID
   * - https://drive.google.com/drive/u/0/folders/FOLDER_ID
   * - https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
   * - ID direto (string alfanumérica de 20+ chars)
   */
  static extractFolderId(url) {
    if (!url) return null;

    // ID direto
    if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) return url.trim();

    const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  /**
   * Lista todos os arquivos em uma pasta do Drive, com paginação.
   * @param {string} folderId
   * @returns {Promise<Array<{id, name, mimeType, size, md5Checksum, createdTime, modifiedTime}>>}
   */
  async listFiles(folderId) {
    await this.#ensureDrive();

    const files = [];
    let pageToken = null;

    do {
      const response = await this.#drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, md5Checksum, createdTime, modifiedTime)',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      files.push(...(response.data.files || []));
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    return files;
  }

  /**
   * Verifica se uma pasta é acessível.
   * @param {string} folderId
   * @returns {Promise<{accessible: boolean, name?: string, error?: string}>}
   */
  async verifyFolder(folderId) {
    await this.#ensureDrive();

    try {
      const response = await this.#drive.files.get({
        fileId: folderId,
        fields: 'id, name, mimeType',
        supportsAllDrives: true,
      });

      if (response.data.mimeType !== 'application/vnd.google-apps.folder') {
        return { accessible: false, error: 'O recurso não é uma pasta' };
      }

      return { accessible: true, name: response.data.name };
    } catch (err) {
      return { accessible: false, error: err.message };
    }
  }
}

export { GoogleDriveFileScanner };
