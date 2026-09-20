import qrcode from 'qrcode-generator';

/**
 * Code 39 barcode generator → inline SVG string (QR below uses qrcode-generator).
 *
 * Code 39 encodes 0–9, A–Z, space and `- . $ / + %`. Each character is 9
 * elements (5 bars / 4 spaces) with exactly three wide elements; characters are
 * separated by a narrow space and the message is wrapped in the `*` start/stop
 * guard. Lowercase input is upper-cased; unsupported characters are dropped.
 *
 * Every symbology here ships its own **quiet zone** and white backing plate (see
 * `svgCodeBarres`), so a code stays scannable wherever it is placed — flush
 * against a frame, or over a coloured card.
 *
 * The SVG carries a `viewBox` and no fixed width/height, so size it via CSS
 * (e.g. `height: 34px; width: auto`). Output is trusted markup (only `<rect>`
 * and `<g>` with numeric coordinates) — safe to inject as raw HTML.
 */
const CODE39: Record<string, string> = {
  '0': '000110100',
  '1': '100100001',
  '2': '001100001',
  '3': '101100000',
  '4': '000110001',
  '5': '100110000',
  '6': '001110000',
  '7': '000100101',
  '8': '100100100',
  '9': '001100100',
  A: '100001001',
  B: '001001001',
  C: '101001000',
  D: '000011001',
  E: '100011000',
  F: '001011000',
  G: '000001101',
  H: '100001100',
  I: '001001100',
  J: '000011100',
  K: '100000011',
  L: '001000011',
  M: '101000010',
  N: '000010011',
  O: '100010010',
  P: '001010010',
  Q: '000000111',
  R: '100000110',
  S: '001000110',
  T: '000010110',
  U: '110000001',
  V: '011000001',
  W: '111000000',
  X: '010010001',
  Y: '110010000',
  Z: '011010000',
  '-': '010000101',
  '.': '110000100',
  ' ': '011000100',
  $: '010101000',
  '/': '010100010',
  '+': '010001010',
  '%': '000101010',
  '*': '010010100', // start / stop guard
};

/**
 * La symbologie qu'une école imprime sur ses documents. `aucun` compte : la
 * plupart des établissements n'ont pas de lecteur, et un code qu'on ne scanne
 * jamais n'est qu'une tache de plus sur le bulletin.
 */
export type TypeCode = 'code39' | 'code128' | 'qr' | 'aucun';

/**
 * Le code d'une valeur dans la symbologie demandée — le seul point d'entrée des
 * gabarits, pour qu'un document n'ait pas à connaître les trois générateurs.
 * Renvoie une chaîne vide pour `aucun` : le gabarit peut l'insérer sans test.
 */
export function codeSvg(type: TypeCode, value: string, opts: { height?: number } = {}): string {
  switch (type) {
    case 'aucun':
      return '';
    case 'qr':
      return qrSvg(value);
    case 'code128':
      return code128Svg(value, opts);
    default:
      return code39Svg(value, opts);
  }
}

/** Keep only characters Code 39 can encode (the `*` guard is added internally). */
export function sanitizeCode39(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((ch) => ch !== '*' && ch in CODE39)
    .join('');
}

interface Code39Options {
  /** Bar height in SVG units (default 38). */
  height?: number;
  /** Narrow element width in SVG units (default 1.5). */
  narrow?: number;
  /** Wide:narrow ratio, 2–3 per the spec (default 2.6). */
  ratio?: number;
  /** Quiet-zone width in *modules* (default 10, the spec minimum). 0 removes it
   *  — only for a caller that provides the margin itself. */
  quiet?: number;
}

/**
 * Zone silencieuse : la marge blanche que la norme exige de part et d'autre des
 * barres, au moins dix fois le module étroit. Sans elle, un lecteur qui trouve
 * de l'encre — un cadre, un fond de carte, une autre étiquette — juste contre la
 * première barre ne repère plus le début du code et refuse de lire.
 */
function quietZone(module: number, modules = 10): number {
  return module * Math.max(0, modules);
}

/**
 * Enveloppe commune aux codes-barres linéaires : un fond **blanc** couvrant la
 * zone silencieuse comprise, puis les barres.
 *
 * Le fond n'est pas décoratif. Une zone silencieuse transparente ne protège que
 * du voisinage dans le flux ; posé sur une carte de couleur ou une photo, le
 * code se retrouve sans contraste et ne se lit pas davantage. `qrSvg` peint déjà
 * le sien — les trois symbologies se comportent enfin pareil.
 *
 * `crispEdges` coupe l'anticrénelage : un bord de barre flou est exactement ce
 * qui rend un code-barres imprimé illisible.
 */
function svgCodeBarres(width: number, height: number, bars: string): string {
  const w = width.toFixed(2);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${height}" ` +
    `preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">` +
    `<rect width="${w}" height="${height}" fill="#fff"/>` +
    `<g fill="#000">${bars}</g></svg>`
  );
}

/**
 * Renders `value` as a real QR-code SVG string (error-correction level M) using
 * the pure-JS, offline `qrcode-generator`. Same trusted-markup contract as
 * {@link code39Svg}: only `<rect>` with numeric coordinates, safe as raw HTML.
 * The SVG carries a `viewBox` and no fixed size — size it via CSS.
 *
 * Carries the same quiet zone as {@link code39Svg}/{@link code128Svg} and for
 * the same reason — a scanner needs that margin to find the code's boundary
 * in the first place. QR's own spec minimum is 4 modules (narrower than the
 * linear symbologies' 10, since QR's finder patterns need less isolation).
 * Missing here for a while: a dense payload (the mobile pairing QR, ~600
 * chars once signed, is a 90+ module code) with zero quiet zone read fine in
 * isolation but failed intermittently once displayed on a real page next to
 * other content — see Gestion_ecole_mobile's DECISIONS.md for the pairing
 * side of this bug.
 */
export function qrSvg(value: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = quietZone(1, 4);
  const size = n + quiet * 2;
  let cells = '';
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c))
        cells += `<rect x="${c + quiet}" y="${r + quiet}" width="1.02" height="1.02"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#fff"/><g fill="#000">${cells}</g></svg>`
  );
}

/**
 * Code 128 (subset B) module-width patterns, value 0–106 (106 = stop, 7
 * elements). Denser than Code 39 and supports the full printable ASCII range.
 */
const CODE128_PATTERNS = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
];

/**
 * Renders `value` as a Code 128 (subset B) barcode `<svg>`. Encodes printable
 * ASCII 32–126; unsupported characters are dropped. Same trusted-markup contract
 * as {@link code39Svg}. Size via CSS (no fixed width/height).
 */
export function code128Svg(
  value: string,
  opts: { height?: number; unit?: number; quiet?: number } = {},
): string {
  const height = opts.height ?? 38;
  const unit = opts.unit ?? 1.2;
  const quiet = quietZone(unit, opts.quiet);
  const codes = [104]; // Start B
  let sum = 104;
  let pos = 1;
  for (const ch of value) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) continue;
    const v = c - 32;
    codes.push(v);
    sum += v * pos;
    pos += 1;
  }
  codes.push(sum % 103); // checksum
  codes.push(106); // Stop

  let x = quiet;
  let bars = '';
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]) * unit;
      if (i % 2 === 0) {
        bars += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}"/>`;
      }
      x += w;
    }
  }
  return svgCodeBarres(Math.max(x + quiet, 1), height, bars);
}

/** Renders `value` as a Code 39 barcode and returns a standalone `<svg>` string. */
export function code39Svg(value: string, opts: Code39Options = {}): string {
  const height = opts.height ?? 38;
  const narrow = opts.narrow ?? 1.5;
  const wide = narrow * (opts.ratio ?? 2.6);
  const quiet = quietZone(narrow, opts.quiet);
  const seq = `*${sanitizeCode39(value)}*`;

  let x = quiet;
  let bars = '';
  for (const ch of seq) {
    const pattern = CODE39[ch];
    for (let i = 0; i < 9; i++) {
      const w = pattern[i] === '1' ? wide : narrow;
      if (i % 2 === 0) {
        bars += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}"/>`;
      }
      x += w;
    }
    x += narrow; // inter-character narrow gap
  }
  return svgCodeBarres(Math.max(x + quiet, 1), height, bars);
}
