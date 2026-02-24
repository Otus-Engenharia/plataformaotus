import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import './WhiteboardView.css';

function WhiteboardView() {
  const { user } = useAuth();
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
  const saveTimeoutRef = useRef(null);
  const excalidrawAPIRef = useRef(null);

  // Carrega o quadro compartilhado
  useEffect(() => {
    async function load() {
      try {
        const { data: res } = await axios.get('/api/whiteboard', { withCredentials: true });
        if (res.success && res.data) {
          setInitialData({
            elements: res.data.elements || [],
            appState: res.data.app_state || {},
            files: res.data.files || {},
          });
        } else {
          setInitialData({ elements: [], appState: {}, files: {} });
        }
      } catch {
        setInitialData({ elements: [], appState: {}, files: {} });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Salva no backend com debounce
  const saveToServer = useCallback(async (elements, appState, files) => {
    setSaveStatus('saving');
    try {
      // Filtrar appState para remover campos que não devem ser persistidos
      const { collaborators, ...cleanAppState } = appState;
      await axios.put('/api/whiteboard', {
        elements,
        appState: cleanAppState,
        files,
      }, { withCredentials: true });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, []);

  const handleChange = useCallback((elements, appState, files) => {
    // Debounce de 2 segundos
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveToServer(elements, appState, files);
    }, 2000);
  }, [saveToServer]);

  // Cleanup do timeout
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (loading) {
    return <div className="whiteboard-loading">Carregando quadro...</div>;
  }

  const statusLabels = {
    saved: 'Salvo',
    saving: 'Salvando...',
    error: 'Erro ao salvar',
  };

  return (
    <div className="whiteboard-container">
      <div className="whiteboard-canvas">
        <Excalidraw
          excalidrawAPI={(api) => { excalidrawAPIRef.current = api; }}
          initialData={initialData}
          onChange={handleChange}
          langCode="pt-BR"
          UIOptions={{
            canvasActions: {
              loadScene: false,
            },
          }}
        />
      </div>
      <div className={`whiteboard-status whiteboard-status--${saveStatus}`}>
        {statusLabels[saveStatus]}
      </div>
    </div>
  );
}

export default WhiteboardView;
