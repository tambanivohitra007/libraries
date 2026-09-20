import { useCallback, useEffect, useRef, useState } from 'react';
import { borner, type Marges } from './paper';

/** Le côté que l'on tire. */
type Cote = keyof Marges;

const COTES: Cote[] = ['haut', 'droite', 'bas', 'gauche'];

/**
 * Feuille miniature dont les quatre marges se règlent **en tirant les guides**.
 *
 * Le réglage au clavier reste possible à côté ; celui-ci sert à trouver la bonne
 * marge à l'œil, comme on pousse un taquet de règle dans un traitement de texte.
 * Le déplacement est converti en millimètres à partir des dimensions réelles de
 * la feuille, pas des pixels affichés : la miniature peut donc changer de taille
 * sans fausser le réglage.
 *
 * Module interne de `print-preview`.
 */
export function MargesInteractives({
  marges,
  dims,
  largeurPx,
  hauteurPx,
  echelleTexte,
  libelleTexte,
  onChange,
  onFin,
}: {
  marges: Marges;
  /** Dimensions réelles de la feuille, en mm. */
  dims: { w: number; h: number };
  largeurPx: number;
  hauteurPx: number;
  echelleTexte: number;
  libelleTexte: string;
  /** Appelé en continu pendant le glissement (aperçu vivant). */
  onChange: (m: Marges) => void;
  /** Appelé au relâchement — le moment où l'on persiste. */
  onFin?: () => void;
}): React.JSX.Element {
  const [tire, setTire] = useState<Cote | null>(null);
  // Les valeurs de départ du geste : on calcule toujours depuis elles, jamais
  // depuis l'état courant, pour que le glissement ne dérive pas.
  const depart = useRef<{ x: number; y: number; marges: Marges } | null>(null);

  const pxParMm = {
    x: largeurPx / dims.w,
    y: hauteurPx / dims.h,
  };

  const onPointerDown = (cote: Cote) => (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    depart.current = { x: e.clientX, y: e.clientY, marges: { ...marges } };
    setTire(cote);
  };

  const deplacer = useCallback(
    (e: PointerEvent): void => {
      const d = depart.current;
      if (!tire || !d) return;
      // Chaque côté se rapproche du centre : la marge croît vers l'intérieur.
      const deltaMm =
        tire === 'gauche'
          ? (e.clientX - d.x) / pxParMm.x
          : tire === 'droite'
            ? (d.x - e.clientX) / pxParMm.x
            : tire === 'haut'
              ? (e.clientY - d.y) / pxParMm.y
              : (d.y - e.clientY) / pxParMm.y;
      // Une marge ne peut pas dévorer la page : on garde 20 mm utiles au moins.
      const maxMm = (tire === 'gauche' || tire === 'droite' ? dims.w : dims.h) / 2 - 10;
      onChange({ ...d.marges, [tire]: borner(d.marges[tire] + deltaMm, maxMm) });
    },
    [tire, pxParMm.x, pxParMm.y, dims.w, dims.h, onChange],
  );

  useEffect(() => {
    if (!tire) return;
    const relacher = (): void => {
      setTire(null);
      depart.current = null;
      onFin?.();
    };
    window.addEventListener('pointermove', deplacer);
    window.addEventListener('pointerup', relacher);
    return () => {
      window.removeEventListener('pointermove', deplacer);
      window.removeEventListener('pointerup', relacher);
    };
  }, [tire, deplacer, onFin]);

  const pct = {
    haut: (marges.haut / dims.h) * 100,
    droite: (marges.droite / dims.w) * 100,
    bas: (marges.bas / dims.h) * 100,
    gauche: (marges.gauche / dims.w) * 100,
  };

  return (
    <div
      className={`pp-marges${tire ? ' is-dragging' : ''}`}
      style={{ width: largeurPx, height: hauteurPx }}
    >
      <div
        className="pp-marges__zone"
        style={{ inset: `${pct.haut}% ${pct.droite}% ${pct.bas}% ${pct.gauche}%` }}
      >
        <span style={{ fontSize: Math.max(4, echelleTexte) }}>{libelleTexte}</span>
      </div>
      {COTES.map((cote) => (
        <div
          key={cote}
          role="separator"
          aria-orientation={cote === 'haut' || cote === 'bas' ? 'horizontal' : 'vertical'}
          aria-label={cote}
          className={`pp-marges__guide pp-marges__guide--${cote}${tire === cote ? ' is-active' : ''}`}
          style={
            cote === 'haut' || cote === 'bas'
              ? { [cote === 'haut' ? 'top' : 'bottom']: `${pct[cote]}%` }
              : { [cote === 'gauche' ? 'left' : 'right']: `${pct[cote]}%` }
          }
          onPointerDown={onPointerDown(cote)}
        >
          <span className="pp-marges__valeur">{marges[cote].toFixed(1)} mm</span>
        </div>
      ))}
    </div>
  );
}
