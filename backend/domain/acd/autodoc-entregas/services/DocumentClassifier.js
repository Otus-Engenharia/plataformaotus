/**
 * Domain Service: DocumentClassifier
 *
 * Classifica documentos Autodoc comparando com documentos existentes.
 * Logica pura de dominio - sem dependencias de infraestrutura.
 */

class DocumentClassifier {
  /**
   * Classifica um documento comparando com documentos existentes que tenham o mesmo code.
   *
   * @param {Object} newDoc - Documento novo { documentCode, revision, phaseName }
   * @param {Array<Object>} existingDocs - Docs existentes com mesmo document_code
   * @returns {Object} { classification, previousRevision?, previousPhase? }
   */
  static classify(newDoc, existingDocs) {
    if (!existingDocs || existingDocs.length === 0) {
      return { classification: 'novo_arquivo' };
    }

    // Ordenar existentes por data (mais recente primeiro)
    const sorted = [...existingDocs].sort(
      (a, b) => new Date(b.autodoc_created_at || b.autodocCreatedAt || 0) - new Date(a.autodoc_created_at || a.autodocCreatedAt || 0)
    );
    const latest = sorted[0];

    const latestPhase = latest.phase_name || latest.phaseName;
    const latestRevision = latest.revision;
    const newPhase = newDoc.phaseName || newDoc.phase_name;
    const newRevision = newDoc.revision;

    // Mudanca de fase (ex: EP → AP)
    if (newPhase && latestPhase && newPhase !== latestPhase) {
      return {
        classification: 'mudanca_fase',
        previousPhase: latestPhase,
      };
    }

    // Nova revisao (ex: R03 → R05)
    if (newRevision && latestRevision && newRevision !== latestRevision) {
      return {
        classification: 'nova_revisao',
        previousRevision: latestRevision,
      };
    }

    // Fallback: mesmo code mas nao identifica mudanca especifica
    return { classification: 'novo_arquivo' };
  }
}

export { DocumentClassifier };
