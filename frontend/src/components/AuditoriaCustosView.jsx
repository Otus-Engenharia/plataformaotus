/**
 * Componente: Reconciliação de Custos
 *
 * Compara custos da fonte financeira (planilha) vs custos distribuídos por projeto.
 * 3 níveis de drill-down: Mensal → Usuários → Projetos
 * Acessível via Configurações > Auditoria Custos.
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/AuditoriaCustosView.css';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const formatMonth = (mes) => {
  if (!mes) return '-';
  const raw = typeof mes === 'object' && mes !== null && 'value' in mes ? mes.value : mes;
  const str = String(raw);
  if (/^\d{4}-\d{2}/.test(str)) {
    const [y, m] = str.split('-');
    return `${m}/${y}`;
  }
  return str;
};

const formatPercent = (value) =>
  `${((value || 0) * 100).toFixed(1)}%`;

const formatHours = (value) =>
  (value || 0).toFixed(1) + 'h';

const TOLERANCE = 1; // R$ 1 de tolerância para arredondamento

function AuditoriaCustosView() {
  // Navegação entre níveis
  const [level, setLevel] = useState('mensal');
  const [selectedMes, setSelectedMes] = useState(null);
  const [selectedUsuario, setSelectedUsuario] = useState(null);

  // Dados de cada nível
  const [monthlyData, setMonthlyData] = useState(null);
  const [usersData, setUsersData] = useState(null);
  const [projectsData, setProjectsData] = useState(null);

  // Estado de loading/erro
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMonthly();
  }, []);

  const fetchMonthly = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/curva-s/reconciliacao-custos`, {
        withCredentials: true,
      });
      if (response.data.success) {
        setMonthlyData(response.data.data);
      } else {
        setError(response.data.error || 'Erro ao carregar reconciliação');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (mes) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/curva-s/reconciliacao-custos/${mes}`, {
        withCredentials: true,
      });
      if (response.data.success) {
        setUsersData(response.data.data);
        setSelectedMes(mes);
        setLevel('usuarios');
      } else {
        setError(response.data.error || 'Erro ao carregar usuários');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async (mes, usuario) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(
        `${API_URL}/api/curva-s/reconciliacao-custos/${mes}/${encodeURIComponent(usuario)}`,
        { withCredentials: true }
      );
      if (response.data.success) {
        setProjectsData(response.data.data);
        setSelectedUsuario(usuario);
        setLevel('projetos');
      } else {
        setError(response.data.error || 'Erro ao carregar projetos');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (targetLevel) => {
    if (targetLevel === 'mensal') {
      setLevel('mensal');
      setSelectedMes(null);
      setSelectedUsuario(null);
      setUsersData(null);
      setProjectsData(null);
    } else if (targetLevel === 'usuarios') {
      setLevel('usuarios');
      setSelectedUsuario(null);
      setProjectsData(null);
    }
  };

  // KPIs do nível mensal
  const monthlyKpis = useMemo(() => {
    if (!monthlyData) return null;
    const divergentes = monthlyData.filter(m => Math.abs(m.diferenca) > TOLERANCE);
    const somaDiferencas = divergentes.reduce((s, m) => s + Math.abs(m.diferenca), 0);
    const maiorDiferenca = divergentes.length > 0
      ? Math.max(...divergentes.map(m => Math.abs(m.diferenca)))
      : 0;
    return {
      mesesDivergentes: divergentes.length,
      totalMeses: monthlyData.length,
      somaDiferencas,
      maiorDiferenca,
    };
  }, [monthlyData]);

  // KPIs do nível de usuários
  const usersKpis = useMemo(() => {
    if (!usersData) return null;
    const naoAlocados = usersData.filter(u => u.status === 'nao_alocado');
    const custoNaoAlocado = naoAlocados.reduce((s, u) => s + Math.abs(u.diferenca), 0);
    const divergentes = usersData.filter(u => Math.abs(u.diferenca) > TOLERANCE);
    return {
      totalUsuarios: usersData.length,
      naoAlocados: naoAlocados.length,
      custoNaoAlocado,
      divergentes: divergentes.length,
    };
  }, [usersData]);

  // --- Renderização ---

  if (loading && !monthlyData) {
    return (
      <div className="audit-view">
        <div className="audit-view-loading">Carregando reconciliação de custos...</div>
      </div>
    );
  }

  if (error && !monthlyData) {
    return (
      <div className="audit-view">
        <div className="audit-view-error">
          <p>{error}</p>
          <button onClick={fetchMonthly}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="audit-view">
      {/* Breadcrumb */}
      <nav className="audit-breadcrumb">
        <span
          className={`audit-breadcrumb-item ${level === 'mensal' ? 'audit-breadcrumb-active' : 'audit-breadcrumb-link'}`}
          onClick={() => level !== 'mensal' && navigateTo('mensal')}
        >
          Reconciliação
        </span>
        {selectedMes && (
          <>
            <span className="audit-breadcrumb-sep">/</span>
            <span
              className={`audit-breadcrumb-item ${level === 'usuarios' ? 'audit-breadcrumb-active' : 'audit-breadcrumb-link'}`}
              onClick={() => level === 'projetos' && navigateTo('usuarios')}
            >
              {formatMonth(selectedMes)}
            </span>
          </>
        )}
        {selectedUsuario && (
          <>
            <span className="audit-breadcrumb-sep">/</span>
            <span className="audit-breadcrumb-item audit-breadcrumb-active">
              {selectedUsuario}
            </span>
          </>
        )}
      </nav>

      {/* Loading overlay para transições entre níveis */}
      {loading && (
        <div className="audit-view-loading-overlay">Carregando...</div>
      )}

      {/* Nível 1: Resumo Mensal */}
      {level === 'mensal' && monthlyData && (
        <>
          {/* KPIs */}
          <div className="audit-view-kpis">
            <div className="audit-view-kpi">
              <span className="audit-view-kpi-value">
                {monthlyKpis.mesesDivergentes} / {monthlyKpis.totalMeses}
              </span>
              <span className="audit-view-kpi-label">Meses com divergencia</span>
            </div>
            <div className="audit-view-kpi">
              <span className="audit-view-kpi-value">{formatCurrency(monthlyKpis.somaDiferencas)}</span>
              <span className="audit-view-kpi-label">Custo nao alocado (total)</span>
            </div>
            <div className="audit-view-kpi">
              <span className="audit-view-kpi-value">{formatCurrency(monthlyKpis.maiorDiferenca)}</span>
              <span className="audit-view-kpi-label">Maior divergencia mensal</span>
            </div>
          </div>

          {/* Tabela mensal */}
          <div className="audit-view-table-wrapper">
            <table className="audit-view-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="text-right">Direto (Fonte)</th>
                  <th className="text-right">Indireto (Fonte)</th>
                  <th className="text-right">Total Fonte</th>
                  <th className="text-right">Total Distribuido</th>
                  <th className="text-right">Diferenca</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((row) => {
                  const isDivergent = Math.abs(row.diferenca) > TOLERANCE;
                  return (
                    <tr
                      key={row.mes}
                      className={`audit-row-clickable ${isDivergent ? 'audit-row-divergente' : 'audit-row-ok'}`}
                      onClick={() => fetchUsers(row.mes)}
                    >
                      <td>{formatMonth(row.mes)}</td>
                      <td className="text-right">{formatCurrency(row.total_direto_fonte)}</td>
                      <td className="text-right">{formatCurrency(row.total_indireto_fonte)}</td>
                      <td className="text-right"><strong>{formatCurrency(row.total_fonte)}</strong></td>
                      <td className="text-right"><strong>{formatCurrency(row.total_dist)}</strong></td>
                      <td className={`text-right ${isDivergent ? 'audit-view-diff' : ''}`}>
                        {formatCurrency(row.diferenca)}
                      </td>
                      <td className="text-center">
                        <span className={`audit-status-badge audit-status-${isDivergent ? 'divergente' : 'ok'}`}>
                          {isDivergent ? 'Divergente' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Nível 2: Usuários do Mês */}
      {level === 'usuarios' && usersData && (
        <>
          {/* KPIs do mês */}
          <div className="audit-view-kpis">
            <div className="audit-view-kpi">
              <span className="audit-view-kpi-value">{usersKpis.totalUsuarios}</span>
              <span className="audit-view-kpi-label">Usuarios no mes</span>
            </div>
            <div className="audit-view-kpi">
              <span className="audit-view-kpi-value">{usersKpis.naoAlocados}</span>
              <span className="audit-view-kpi-label">Nao alocados</span>
            </div>
            <div className="audit-view-kpi">
              <span className="audit-view-kpi-value">{formatCurrency(usersKpis.custoNaoAlocado)}</span>
              <span className="audit-view-kpi-label">Custo nao alocado</span>
            </div>
          </div>

          {/* Tabela de usuários */}
          <div className="audit-view-table-wrapper">
            <table className="audit-view-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th className="text-right">Salario (Fonte)</th>
                  <th className="text-right">Indireto (Fonte)</th>
                  <th className="text-right">Total Fonte</th>
                  <th className="text-right">Total Distribuido</th>
                  <th className="text-right">Projetos</th>
                  <th className="text-right">Diferenca</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {usersData.map((row) => {
                  const isClickable = row.status !== 'nao_alocado' && row.qtd_projetos > 0;
                  return (
                    <tr
                      key={row.usuario}
                      className={`${isClickable ? 'audit-row-clickable' : ''} audit-row-${row.status}`}
                      onClick={() => isClickable && fetchProjects(selectedMes, row.usuario)}
                    >
                      <td>{row.usuario}</td>
                      <td className="text-right">{formatCurrency(row.salario_fonte)}</td>
                      <td className="text-right">{formatCurrency(row.indireto_fonte)}</td>
                      <td className="text-right"><strong>{formatCurrency(row.total_fonte_usuario)}</strong></td>
                      <td className="text-right"><strong>{formatCurrency(row.total_dist)}</strong></td>
                      <td className="text-right">{row.qtd_projetos || 0}</td>
                      <td className={`text-right ${Math.abs(row.diferenca) > TOLERANCE ? 'audit-view-diff' : ''}`}>
                        {formatCurrency(row.diferenca)}
                      </td>
                      <td className="text-center">
                        <span className={`audit-status-badge audit-status-${row.status}`}>
                          {row.status === 'nao_alocado' ? 'Nao Alocado' : row.status === 'sem_fonte' ? 'Sem Fonte' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="audit-summary-footer">
                  <td><strong>Total</strong></td>
                  <td className="text-right"><strong>{formatCurrency(usersData.reduce((s, r) => s + r.salario_fonte, 0))}</strong></td>
                  <td className="text-right"><strong>{formatCurrency(usersData.reduce((s, r) => s + r.indireto_fonte, 0))}</strong></td>
                  <td className="text-right"><strong>{formatCurrency(usersData.reduce((s, r) => s + r.total_fonte_usuario, 0))}</strong></td>
                  <td className="text-right"><strong>{formatCurrency(usersData.reduce((s, r) => s + r.total_dist, 0))}</strong></td>
                  <td className="text-right"><strong>{usersData.reduce((s, r) => s + r.qtd_projetos, 0)}</strong></td>
                  <td className="text-right audit-view-diff">
                    <strong>{formatCurrency(usersData.reduce((s, r) => s + r.diferenca, 0))}</strong>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* Nível 3: Projetos do Usuário */}
      {level === 'projetos' && projectsData && (
        <>
          {/* Info do usuário selecionado */}
          {usersData && (() => {
            const userInfo = usersData.find(u => u.usuario === selectedUsuario);
            if (!userInfo) return null;
            return (
              <div className="audit-view-kpis">
                <div className="audit-view-kpi">
                  <span className="audit-view-kpi-value">{formatCurrency(userInfo.total_fonte_usuario)}</span>
                  <span className="audit-view-kpi-label">Custo fonte (usuario)</span>
                </div>
                <div className="audit-view-kpi">
                  <span className="audit-view-kpi-value">{formatCurrency(userInfo.total_dist)}</span>
                  <span className="audit-view-kpi-label">Total distribuido</span>
                </div>
                <div className="audit-view-kpi">
                  <span className="audit-view-kpi-value">{projectsData.length}</span>
                  <span className="audit-view-kpi-label">Projetos alocados</span>
                </div>
              </div>
            );
          })()}

          {/* Tabela de projetos */}
          <div className="audit-view-table-wrapper">
            <table className="audit-view-table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Codigo</th>
                  <th className="text-right">Horas</th>
                  <th className="text-right">Horas Totais</th>
                  <th className="text-right">Peso</th>
                  <th className="text-right">Custo Direto</th>
                  <th className="text-right">Custo Indireto</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {projectsData.map((row, i) => (
                  <tr key={i}>
                    <td>{row.projeto}</td>
                    <td>{row.project_code}</td>
                    <td className="text-right">{formatHours(row.horas)}</td>
                    <td className="text-right">{formatHours(row.horas_totais)}</td>
                    <td className="text-right">{formatPercent(row.peso)}</td>
                    <td className="text-right">{formatCurrency(row.custo_direto)}</td>
                    <td className="text-right">{formatCurrency(row.custo_indireto)}</td>
                    <td className="text-right"><strong>{formatCurrency(row.custo_total)}</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="audit-summary-footer">
                  <td colSpan={2}><strong>Total</strong></td>
                  <td className="text-right"><strong>{formatHours(projectsData.reduce((s, r) => s + r.horas, 0))}</strong></td>
                  <td className="text-right"></td>
                  <td className="text-right"><strong>{formatPercent(projectsData.reduce((s, r) => s + r.peso, 0))}</strong></td>
                  <td className="text-right"><strong>{formatCurrency(projectsData.reduce((s, r) => s + r.custo_direto, 0))}</strong></td>
                  <td className="text-right"><strong>{formatCurrency(projectsData.reduce((s, r) => s + r.custo_indireto, 0))}</strong></td>
                  <td className="text-right"><strong>{formatCurrency(projectsData.reduce((s, r) => s + r.custo_total, 0))}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default AuditoriaCustosView;
