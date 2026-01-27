/**
 * Context para gerenciar o estado do Oraculo
 * Permite que outros componentes saibam se o Oraculo está aberto
 */

import React, { createContext, useContext, useState } from 'react';

const OracleContext = createContext();

export function OracleProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOracle = () => {
    setIsOpen(prev => !prev);
  };

  return (
    <OracleContext.Provider value={{ isOpen, toggleOracle }}>
      {children}
    </OracleContext.Provider>
  );
}

export function useOracle() {
  const context = useContext(OracleContext);
  if (!context) {
    throw new Error('useOracle must be used within OracleProvider');
  }
  return context;
}
