import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Hook que envia um heartbeat ao servidor a cada 5 minutos enquanto o usuário
 * está autenticado e a aba está visível. Usado para rastrear tempo de uso.
 */
export function useHeartbeat() {
  const { user } = useAuth();
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    async function sendHeartbeat() {
      if (document.visibilityState !== 'visible') return;
      try {
        await fetch('/api/user/heartbeat', { method: 'POST' });
      } catch {
        // Falha silenciosa - não impacta experiência do usuário
      }
    }

    // Envia imediatamente ao montar e a cada 5 minutos
    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(intervalRef.current);
  }, [user]);
}
