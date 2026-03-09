/**
 * Value Object: IfcFileName
 * Parser flexível de nomes de arquivos de engenharia (IFC, RVT, DWG, etc.)
 *
 * Extrai: disciplina, fase, revisão e baseName (identidade do arquivo).
 * Os nomes variam por projeto, então o parser é best-effort com fallback.
 */

const KNOWN_PHASES = ['EP', 'AP', 'PB', 'PE', 'AS'];

const KNOWN_DISCIPLINES = [
  'ARQ', 'EST', 'HID', 'ELE', 'MEP', 'CLM', 'INC',
  'ACV', 'TER', 'PAI', 'COM', 'AUT', 'PCI', 'GEO',
  'MEC', 'SPK', 'DRE', 'FUN', 'VED', 'IMP', 'PSG',
];

const REVISION_PATTERNS = [
  /^R(\d{2,})$/,         // R00, R01, R02...
  /^REV([A-Z0-9]+)$/,   // REVA, REVB, REV01
  /^V(\d+)$/,           // V1, V2...
];

const ENGINEERING_EXTENSIONS = [
  'ifc', 'rvt', 'dwg', 'dxf', 'nwd', 'nwc', 'nwf',
  'skp', 'pln', 'bim', 'dgn', 'sat', 'stp', 'step',
  'pdf', 'dwf', 'dwfx',
];

class IfcFileName {
  #rawName;
  #baseName;
  #phase;
  #revision;
  #discipline;
  #extension;

  constructor(rawName) {
    if (!rawName || typeof rawName !== 'string') {
      throw new Error('Nome do arquivo é obrigatório');
    }

    this.#rawName = rawName;
    const parsed = IfcFileName.parse(rawName);
    this.#baseName = parsed.baseName;
    this.#phase = parsed.phase;
    this.#revision = parsed.revision;
    this.#discipline = parsed.discipline;
    this.#extension = parsed.extension;
    Object.freeze(this);
  }

  get rawName() { return this.#rawName; }
  get baseName() { return this.#baseName; }
  get phase() { return this.#phase; }
  get revision() { return this.#revision; }
  get discipline() { return this.#discipline; }
  get extension() { return this.#extension; }

  /**
   * Verifica se dois arquivos representam o mesmo deliverable
   * (mesmo baseName e disciplina, mas possivelmente fase/revisão diferentes)
   */
  hasSameBase(other) {
    if (!(other instanceof IfcFileName)) return false;
    return this.#baseName === other.baseName && this.#discipline === other.discipline;
  }

  toJSON() {
    return {
      rawName: this.#rawName,
      baseName: this.#baseName,
      phase: this.#phase,
      revision: this.#revision,
      discipline: this.#discipline,
      extension: this.#extension,
    };
  }

  /**
   * Parse estático - extrai componentes de um nome de arquivo
   */
  static parse(rawName) {
    // 1. Separar extensão
    const extMatch = rawName.match(/\.([a-zA-Z0-9]+)$/);
    const extension = extMatch ? extMatch[1].toLowerCase() : null;
    let name = extension ? rawName.slice(0, -extension.length - 1) : rawName;

    // 2. Normalizar separadores → uppercase segments
    const normalized = name.replace(/[-_\s]+/g, '-').toUpperCase();
    const segments = normalized.split('-').filter(Boolean);

    // 3. Extrair fase (EP, AP, PB, PE, AS)
    let phase = null;
    const phaseIndex = segments.findIndex(s => KNOWN_PHASES.includes(s));
    if (phaseIndex !== -1) {
      phase = segments[phaseIndex];
      segments.splice(phaseIndex, 1);
    }

    // 4. Extrair revisão (R00, R01, REV_A, V1)
    let revision = null;
    const revIndex = segments.findIndex(s =>
      REVISION_PATTERNS.some(p => p.test(s))
    );
    if (revIndex !== -1) {
      revision = segments[revIndex];
      segments.splice(revIndex, 1);
    }

    // 5. Extrair disciplina (primeiro segmento se for código conhecido)
    let discipline = null;
    if (segments.length > 0 && KNOWN_DISCIPLINES.includes(segments[0])) {
      discipline = segments[0];
      segments.splice(0, 1);
    }

    // 6. BaseName = segmentos restantes (identidade do arquivo)
    const baseName = segments.join('-') || normalized;

    return { baseName, phase, revision, discipline, extension };
  }

  static get KNOWN_PHASES() { return KNOWN_PHASES; }
  static get KNOWN_DISCIPLINES() { return KNOWN_DISCIPLINES; }
  static get ENGINEERING_EXTENSIONS() { return ENGINEERING_EXTENSIONS; }
}

export { IfcFileName };
