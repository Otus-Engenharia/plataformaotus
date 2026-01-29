import React, { useState } from 'react';
import BugReportDialog from './BugReportDialog';
import './BugReportFAB.css';

/**
 * Floating Action Button para reportar bugs/erros
 * Aparece em todas as páginas (exceto login/home)
 */
export default function BugReportFAB() {
  const [isHovered, setIsHovered] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <button
        className={`bug-fab ${isHovered ? 'bug-fab--expanded' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsDialogOpen(true)}
        title="Reportar Bug"
        aria-label="Reportar Bug"
      >
        <svg
          className="bug-fab__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
          <path d="M12 20c-3.3 0-6-2.7-6-6v-3a6 6 0 0112 0v3c0 3.3-2.7 6-6 6z" />
          <path d="M12 20v2M3 13h3M18 13h3M6.53 17.47l-2.12 2.12M17.47 17.47l2.12 2.12" />
        </svg>
        <span className="bug-fab__text">Reportar Bug</span>
      </button>

      {isDialogOpen && (
        <BugReportDialog onClose={() => setIsDialogOpen(false)} />
      )}
    </>
  );
}
