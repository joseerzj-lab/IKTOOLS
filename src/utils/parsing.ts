/**
 * Normalizes string for header matching (lowercase, no accents).
 */
export const normalizeHeader = (str: string) => {
  return str?.toString().toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim() || '';
};

/**
 * Detects the most likely separator in a line of text.
 */
export const detectSeparator = (line: string) => {
  const s = (line.match(/;/g) || []).length;
  const c = (line.match(/,/g) || []).length;
  const t = (line.match(/\t/g) || []).length;
  if (t >= s && t >= c && t > 0) return '\t';
  return s >= c ? ';' : ',';
};

/**
 * Parses a delimited line, handling quotes.
 */
export const parseDelimitedLine = (line: string, sep: string) => {
  const result: string[] = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === sep && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else current += char;
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
};

/**
 * Parses delimited text (TSV, CSV, etc.).
 */
export const parseDelimitedText = (text: string) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const sep = detectSeparator(lines[0]);
  const headers = parseDelimitedLine(lines[0], sep);
  const rows = lines.slice(1).map(line => parseDelimitedLine(line, sep));

  return { headers, rows, separator: sep };
};

/**
 * Helper to get a row as an object based on normalized headers.
 */
export const getRowAsObject = (headers: string[], row: string[]) => {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => {
    obj[normalizeHeader(h)] = row[i] || '';
  });
  return obj;
};

/**
 * Standard mapping for common logistics columns.
 */
export const LOGISTICS_COLUMN_MAP = {
  iso: ['iso', 'unidad', 'id', 'codigo', 'numero', 'referencia', 'nro'],
  comuna: ['comuna', 'ciudad', 'localidad', 'city', 'municipio'],
  direccion: ['direccion', 'dirección', 'calle', 'domicilio', 'address', 'destino'],
  comentario: ['comentario', 'nota', 'observacion', 'comment', 'comentarios'],
  vehiculo: ['vehiculo', 'vehículo', 'camion', 'transporte', 'truck', 'veh']
};
