/**
 * Validador de nomenclatura de arquivos
 *
 * Funções compartilhadas para validar nomes de arquivos contra
 * padrões de segmentos configurados por projeto.
 */

/**
 * Valida um nome de arquivo contra o padrão de segmentos
 * @param {string} fileName - Nome do arquivo (com extensão)
 * @param {Array} segments - Array de segmentos do padrão
 * @returns {{ fileName: string, conforme: boolean, erros: string[] }}
 */
function validateFileName(fileName, segments) {
  const result = { fileName, conforme: false, erros: [] };

  // Remover extensão
  const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
  const name = extMatch ? fileName.slice(0, -extMatch[0].length) : fileName;

  // Separadores possíveis no padrão
  const separators = segments.map(s => s.separator).filter(Boolean);
  const allSeps = [...new Set(separators)];
  if (allSeps.length === 0) allSeps.push('-');

  // Build regex from segments
  const parts = splitBySegments(name, segments);

  if (!parts) {
    // Fallback: split genérico e comparar contagem
    const sepRegex = new RegExp(`[${allSeps.map(escapeRegex).join('')}]`);
    const fileParts = name.split(sepRegex);

    if (fileParts.length !== segments.length) {
      result.erros.push(
        `Esperado ${segments.length} segmentos, encontrado ${fileParts.length}`
      );
      return result;
    }

    // Verificar segmentos fixos
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type === 'fixed') {
        if (fileParts[i].toUpperCase() !== seg.value.toUpperCase()) {
          result.erros.push(
            `Segmento ${i + 1}: esperado "${seg.value}", encontrado "${fileParts[i]}"`
          );
        }
      }
    }

    result.conforme = result.erros.length === 0;
    return result;
  }

  result.conforme = parts.valid;
  result.erros = parts.erros;
  return result;
}

/**
 * Tenta split estruturado baseado nos separadores definidos nos segmentos
 */
function splitBySegments(name, segments) {
  let remaining = name;
  const erros = [];
  let valid = true;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;

    const nextSep = !isLast && segments[i + 1]?.separator
      ? segments[i + 1].separator
      : null;

    let value;

    if (nextSep) {
      const sepIndex = remaining.indexOf(nextSep);
      if (sepIndex === -1) {
        value = remaining;
        remaining = '';
      } else {
        value = remaining.slice(0, sepIndex);
        remaining = remaining.slice(sepIndex + nextSep.length);
      }
    } else {
      value = remaining;
      remaining = '';
    }

    if (i === 0 && seg.separator && value.startsWith(seg.separator)) {
      value = value.slice(seg.separator.length);
    }

    if (seg.type === 'fixed') {
      if (value.toUpperCase() !== seg.value.toUpperCase()) {
        erros.push(`Segmento "${seg.value}": encontrado "${value}"`);
        valid = false;
      }
    } else if (seg.type === 'revision') {
      if (!/^R\d{2,}$/i.test(value) && !/^REV[A-Z0-9]+$/i.test(value)) {
        erros.push(`Revisão: formato inválido "${value}" (esperado RXX)`);
        valid = false;
      }
    }
  }

  return { valid, erros };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Valida múltiplos arquivos contra padrões de nomenclatura de seus projetos.
 * @param {Array<{file_name: string, project_code: string}>} files
 * @param {Map<string, Array>} patternsByProject - Map de project_code -> segments
 * @returns {Map<string, {conforme: boolean|null, erros: string[]}>} Map de file_name -> resultado
 */
function validateFilesInBatch(files, patternsByProject) {
  const results = new Map();

  for (const file of files) {
    const segments = patternsByProject.get(file.project_code);
    if (!segments) {
      results.set(`${file.project_code}::${file.file_name}`, { conforme: null, erros: [] });
      continue;
    }

    const validation = validateFileName(file.file_name, segments);
    results.set(`${file.project_code}::${file.file_name}`, {
      conforme: validation.conforme,
      erros: validation.erros,
    });
  }

  return results;
}

export { validateFileName, splitBySegments, escapeRegex, validateFilesInBatch };
