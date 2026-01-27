/**
 * Hook: useViewAccess
 * 
 * Verifica se o usuário tem acesso a uma vista específica
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { API_URL } from '../api';

/**
 * Hook para verificar acesso a uma vista
 * @param {string} viewId - ID da vista (ex: 'projetos', 'horas')
 * @returns {boolean} - true se o usuário tem acesso
 */
export function useViewAccess(viewId) {
  const { user, isPrivileged } = useAuth();
  const [hasAccess, setHasAccess] = useState(true); // Por padrão, permite acesso
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !viewId) {
      setLoading(false);
      return;
    }

    // Diretores e admins têm acesso a tudo
    if (isPrivileged) {
      setHasAccess(true);
      setLoading(false);
      return;
    }

    // Busca as permissões de vistas do usuário
    const checkAccess = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/user/my-views`, {
          withCredentials: true,
        });

        if (response.data?.success) {
          const userViews = response.data.data || [];
          // Se o usuário não tem permissões específicas definidas,
          // permite acesso baseado apenas no nível de acesso
          // Se tem permissões definidas, verifica se a vista está na lista
          if (userViews.length === 0) {
            // Sem permissões específicas = acesso baseado em role
            setHasAccess(true);
          } else {
            // Com permissões específicas = verifica se a vista está permitida
            setHasAccess(userViews.includes(viewId));
          }
        } else {
          // Em caso de erro, permite acesso (fallback)
          setHasAccess(true);
        }
      } catch (err) {
        console.error('Erro ao verificar acesso à vista:', err);
        // Em caso de erro, permite acesso (fallback)
        setHasAccess(true);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [user, viewId, isPrivileged]);

  return { hasAccess, loading };
}
