/**
 * Rotas: IFC Change Log
 *
 * Endpoints para monitoramento de mudanças em pastas IFC do Google Drive.
 */

import express from 'express';
import { SupabaseIfcChangeLogRepository } from '../infrastructure/repositories/SupabaseIfcChangeLogRepository.js';
import { GoogleDriveFileScanner } from '../infrastructure/services/GoogleDriveFileScanner.js';
import {
  ScanProjectFolder,
  ScanAllFolders,
  ListChangeLogs,
  ListRecentChanges,
} from '../application/use-cases/ifc-changelog/index.js';

const router = express.Router();
let repository = null;
let driveScanner = null;

function getRepository() {
  if (!repository) repository = new SupabaseIfcChangeLogRepository();
  return repository;
}

function getDriveScanner() {
  if (!driveScanner) driveScanner = new GoogleDriveFileScanner();
  return driveScanner;
}

function createRoutes(requireAuth, isPrivileged, logAction) {
  /**
   * POST /api/ifc-changelog/scan-all
   * Escaneia todas as pastas IFC. Privileged only.
   */
  router.post('/scan-all', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const useCase = new ScanAllFolders(getRepository(), getDriveScanner());
      const result = await useCase.execute({ scannedBy: req.user.email });

      if (logAction) {
        await logAction(req, 'scan-all', 'ifc-changelog', null, 'Scan all IFC folders', {
          totalProjects: result.totalProjects,
          totalChanges: result.totalChanges,
        });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao escanear todas as pastas IFC:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/ifc-changelog/recent
   * Mudanças recentes em todos os projetos.
   * Query: ?page=1&limit=20&days=7
   */
  router.get('/recent', requireAuth, async (req, res) => {
    try {
      const { page = 1, limit = 20, days = 7 } = req.query;
      const useCase = new ListRecentChanges(getRepository());
      const result = await useCase.execute({
        page: Number(page),
        limit: Number(limit),
        days: Number(days),
      });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Erro ao buscar mudanças recentes:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/ifc-changelog/scan/:projectCode
   * Escaneia a pasta IFC de um projeto específico.
   */
  router.post('/scan/:projectCode', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { projectCode } = req.params;
      const repo = getRepository();

      // Buscar link_ifc do projeto
      const projects = await repo.findProjectsWithIfcLinks();
      const project = projects.find(p => p.projectCode === projectCode);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Projeto não possui pasta IFC configurada',
        });
      }

      const useCase = new ScanProjectFolder(repo, getDriveScanner());
      const result = await useCase.execute({
        projectCode,
        driveFolderUrl: project.linkIfc,
        scannedBy: req.user.email,
      });

      if (logAction) {
        await logAction(req, 'scan', 'ifc-changelog', projectCode, 'Scan IFC folder', {
          changesDetected: result.changesDetected,
        });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao escanear pasta IFC:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/ifc-changelog/:projectCode
   * Logs de mudança de um projeto.
   * Query: ?page=1&limit=50&category=nova_revisao
   */
  router.get('/:projectCode', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.params;
      const { page = 1, limit = 50, category } = req.query;

      const useCase = new ListChangeLogs(getRepository());
      const result = await useCase.execute({
        projectCode,
        page: Number(page),
        limit: Number(limit),
        category: category || null,
      });

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Erro ao buscar change logs:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export { createRoutes };
