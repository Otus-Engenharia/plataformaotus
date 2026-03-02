import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import RelatoCreateDialog from './RelatoCreateDialog';
import './RelatoCreateFAB.css';

/**
 * Floating Action Button para criar Relatos rapidamente
 * Aparece em todas as páginas (exceto login/home)
 */
export default function RelatoCreateFAB() {
  const { effectiveUser } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [prioridades, setPrioridades] = useState([]);

  useEffect(() => {
    if (!isDialogOpen) return;

    async function fetchData() {
      try {
        const [portfolioRes, tiposRes, prioridadesRes] = await Promise.all([
          axios.get('/api/portfolio', { withCredentials: true }),
          axios.get('/api/relatos/tipos', { withCredentials: true }),
          axios.get('/api/relatos/prioridades', { withCredentials: true }),
        ]);
        if (portfolioRes.data?.data) setProjects(portfolioRes.data.data);
        if (tiposRes.data?.success) setTipos(tiposRes.data.data || []);
        if (prioridadesRes.data?.success) setPrioridades(prioridadesRes.data.data || []);
      } catch (err) {
        console.error('Erro ao carregar dados para criar Relato:', err);
      }
    }

    fetchData();
  }, [isDialogOpen]);

  const handleSave = async (formData) => {
    const res = await axios.post('/api/relatos', formData, { withCredentials: true });
    if (res.data.success) {
      setIsDialogOpen(false);
    }
  };

  return (
    <>
      <button
        className={`relato-fab ${isHovered ? 'relato-fab--expanded' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsDialogOpen(true)}
        title="Novo Relato"
        aria-label="Novo Relato"
      >
        <svg
          className="relato-fab__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        <span className="relato-fab__text">Novo Relato</span>
      </button>

      {isDialogOpen && (
        <RelatoCreateDialog
          projects={projects}
          tipos={tipos}
          prioridades={prioridades}
          userTeamName={effectiveUser?.team_name}
          onSave={handleSave}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </>
  );
}
