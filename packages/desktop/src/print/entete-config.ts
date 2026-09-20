/**
 * The school document branding (header + footer), shared by every printed
 * document so the letterhead is designed once and rendered identically
 * everywhere. Pure string builders — no Electron/Node/DOM — so both the main
 * process (bulletin templates) and the renderer (receipts, payslips, fiches…)
 * import the same code, guaranteeing the preview and the PDF always match.
 *
 * The markup is self-contained and namespaced (`ent*` header, `entf*` footer) so
 * it never collides with a host document's own CSS. Callers splice {@link enteteCss}
 * into their `<style>` block once, then place {@link renderEntete} /
 * {@link renderPied} where they want the bands.
 */
/**
 * A designed banner produced by the host's own editor. The print module only
 * carries it through to whoever renders it, never reads inside it, so its
 * inner shape stays the host's business.
 */
export interface EnteteDesign {
  largeur: number;
  hauteur: number;
  face: unknown;
}
import type { TypeCode } from './barcode';

export type PoliceEntete = 'segoe' | 'serif' | 'mono';
export type LogoPosition = 'gauche' | 'centre';
/** Letterhead mode: the structured HTML band, or a freeform rasterised banner. */
export type EnteteMode = 'simple' | 'avance';

/** The persisted branding choices (stored as a JSON `Parametre`). */
export interface EnteteConfig {
  /** Accent colour for the school name and the divider rule. */
  accent: string;
  /** Font family of the header band. */
  police: PoliceEntete;
  /** Logo height in px (also caps its width). */
  logoTaille: number;
  /** Logo to the left of the identity, or centred above it. */
  logoPosition: LogoPosition;
  afficherLogo: boolean;
  afficherMinistere: boolean;
  /** A free République/devise line above the school name (off by default). */
  afficherRepublique: boolean;
  republique: string;
  afficherNom: boolean;
  /** The BP · Tél · adresse contact line, composed from the school identity. */
  afficherContact: boolean;
  /** Draw the accent divider under the header / a rule above the footer. */
  afficherTrait: boolean;
  /** Free footer text, left and right. Empty → no footer band is emitted. */
  piedGauche: string;
  piedDroite: string;
  /** Header mode: « simple » uses the structured band; « avance » uses the
   *  freeform banner image. Independent from the footer mode. */
  mode: EnteteMode;
  /** The editable freeform header banner (Avancé); null until first saved. */
  bandeauDesign: EnteteDesign | null;
  /** The rasterised header banner (PNG data URL) — embedded by every document so
   *  the main process needs no Konva. Regenerated on each save of the design. */
  bandeauImage: string | null;
  /** Symbologie des codes imprimés sur les documents (bulletin, reçu). Un choix
   *  d'établissement, pas de document : une école scanne avec un seul appareil,
   *  et un bulletin en QR face à un reçu en Code 39 ferait un appel au support. */
  typeCode: TypeCode;
  /** Footer mode: « simple » uses the left/right text band; « avance » uses a
   *  freeform footer banner image. Independent from the header mode. */
  piedMode: EnteteMode;
  /** The editable freeform footer banner (Avancé); null until first saved. */
  piedDesign: EnteteDesign | null;
  /** The rasterised footer banner (PNG data URL). */
  piedImage: string | null;
}

/** School-identity fields the header reads (a subset of `Etablissement`). */
export interface EnteteEtab {
  nom: string;
  ministere: string;
  bp: string;
  telephone: string;
  adresse: string;
  ville: string;
}

export interface RenderEnteteOptions {
  /** Compact letterhead for narrow documents (receipts, payslips): smaller, the
   *  identity sits left of the logo and the aside is dropped. */
  compact?: boolean;
  /** Right-aligned block in the full header (e.g. an « Année scolaire » box).
   *  Caller-supplied HTML — not escaped. Ignored in compact/centred layouts. */
  aside?: string;
}

const POLICES: Record<PoliceEntete, string> = {
  segoe: "'Segoe UI', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Consolas', 'Courier New', monospace",
};

/** The default branding — reproduces the historical bulletin letterhead, so a
 *  school that never opens the designer sees no change. */
export function enteteParDefaut(): EnteteConfig {
  return {
    accent: '#1f3a5f',
    police: 'segoe',
    logoTaille: 54,
    logoPosition: 'gauche',
    afficherLogo: true,
    afficherMinistere: true,
    afficherRepublique: false,
    republique: '',
    afficherNom: true,
    afficherContact: true,
    afficherTrait: true,
    piedGauche: '',
    piedDroite: '',
    mode: 'simple',
    bandeauDesign: null,
    bandeauImage: null,
    typeCode: 'code39',
    piedMode: 'simple',
    piedDesign: null,
    piedImage: null,
  };
}

/** Merge a partial (possibly older) saved config onto the current defaults, so
 *  reading a stored value never yields missing fields. */
export function enteteAvecDefauts(partiel: Partial<EnteteConfig> | null | undefined): EnteteConfig {
  return { ...enteteParDefaut(), ...(partiel ?? {}) };
}

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

/** The composed contact line (BP · Tél · adresse, ville), or '' if no data. */
function contactLine(etab: EnteteEtab): string {
  return [
    etab.bp && `BP ${etab.bp}`,
    etab.telephone && `Tél ${etab.telephone}`,
    [etab.adresse, etab.ville].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The CSS for the header/footer bands, parameterised by the config. Include
 *  once per document; covers both the full and compact (`ent--compact`) layouts. */
export function enteteCss(config: EnteteConfig): string {
  const font = POLICES[config.police];
  const trait = config.afficherTrait;
  return (
    `.ent{display:flex;align-items:center;gap:10px;font-family:${font};` +
    `padding-bottom:6px;${trait ? `border-bottom:2px solid ${config.accent};` : ''}}` +
    `.ent__logo img{height:${config.logoTaille}px;width:auto;max-width:${
      config.logoTaille + 18
    }px;object-fit:contain;display:block}` +
    `.ent__id{flex:1;text-align:center}` +
    `.ent--center{flex-direction:column;text-align:center}` +
    `.ent--compact{gap:8px;margin-bottom:8px}` +
    `.ent--compact .ent__id{text-align:left}` +
    `.ent__min{font-size:11px;text-transform:uppercase;letter-spacing:.3px}` +
    `.ent__rep{font-size:11px;font-style:italic;margin-bottom:2px}` +
    `.ent__nom{font-weight:700;font-size:15px;color:${config.accent}}` +
    `.ent--compact .ent__nom{font-size:14px}` +
    `.ent__con{font-size:10px;color:#444}` +
    `.ent__aside{text-align:right;font-size:10px;white-space:nowrap}` +
    `.entf{display:flex;justify-content:space-between;gap:12px;font-size:9px;color:#666;` +
    `padding-top:3px;margin-top:10px;${trait ? 'border-top:1px solid #ccc;' : ''}}` +
    `.entf__l{flex:1}.entf__r{flex:1;text-align:right}` +
    `.ent-bandeau-wrap{margin-bottom:6px}.ent-bandeau{display:block;width:100%;height:auto}`
  );
}

/** The header band HTML for the given config + school identity. */
export function renderEntete(
  config: EnteteConfig,
  etab: EnteteEtab,
  logo: string | null | undefined,
  opts: RenderEnteteOptions = {},
): string {
  // Avancé mode: emit the pre-rasterised banner, scaled to the document width.
  // A caller aside (e.g. the bulletin's année box) is kept below the banner so
  // documents don't lose it. Falls back to the structured band until rasterised.
  if (config.mode === 'avance' && config.bandeauImage) {
    const aside = opts.aside && !opts.compact ? `<div class="ent__aside">${opts.aside}</div>` : '';
    return (
      `<header class="ent-bandeau-wrap">` +
      `<img class="ent-bandeau" src="${config.bandeauImage}" alt="">${aside}</header>`
    );
  }

  const compact = opts.compact ?? false;
  const centre = config.logoPosition === 'centre' && !compact;
  const cls = `ent${compact ? ' ent--compact' : ''}${centre ? ' ent--center' : ''}`;

  const logoHtml = config.afficherLogo
    ? `<div class="ent__logo"><img src="${logo}" alt=""></div>`
    : '';
  const contact = contactLine(etab);
  const ident =
    `<div class="ent__id">` +
    (config.afficherMinistere && etab.ministere
      ? `<div class="ent__min">${esc(etab.ministere)}</div>`
      : '') +
    (config.afficherRepublique && config.republique.trim()
      ? `<div class="ent__rep">${esc(config.republique)}</div>`
      : '') +
    (config.afficherNom ? `<div class="ent__nom">${esc(etab.nom)}</div>` : '') +
    (config.afficherContact && contact ? `<div class="ent__con">${contact}</div>` : '') +
    `</div>`;
  const aside =
    opts.aside && !compact && !centre ? `<div class="ent__aside">${opts.aside}</div>` : '';

  return `<header class="${cls}">${logoHtml}${ident}${aside}</header>`;
}

/** The footer band HTML, or '' when there is nothing to show. The free text can
 *  be overridden per-document via `opts`; otherwise the config values are used. */
export function renderPied(
  config: EnteteConfig,
  opts: { gauche?: string; droite?: string } = {},
): string {
  // Avancé footer: the pre-rasterised banner, scaled to the document width.
  if (config.piedMode === 'avance' && config.piedImage) {
    return `<footer class="ent-bandeau-wrap"><img class="ent-bandeau" src="${config.piedImage}" alt=""></footer>`;
  }
  const gauche = (opts.gauche ?? config.piedGauche).trim();
  const droite = (opts.droite ?? config.piedDroite).trim();
  if (!gauche && !droite) return '';
  return (
    `<footer class="entf">` +
    `<span class="entf__l">${esc(gauche)}</span>` +
    `<span class="entf__r">${esc(droite)}</span>` +
    `</footer>`
  );
}
