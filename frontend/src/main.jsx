/**
 * Ponto de entrada da aplicação React
 * 
 * Este arquivo renderiza o componente App dentro do elemento #root
 * do index.html
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
