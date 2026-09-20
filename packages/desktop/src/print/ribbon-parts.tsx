import type { ReactNode } from 'react';
import { Tooltip } from 'antd';

/**
 * Primitives du ruban : groupe légendé, bouton de commande, séparateur.
 *
 * Module interne de `print-preview` — l'aspect DevExpress du ruban tient dans
 * ces trois éléments plus la feuille de styles du composant.
 */

/** A captioned ribbon group (DevExpress-style): a row of commands above a label. */
export function RbGroup({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className="pp-rb-group">
      <div className="pp-rb-cmds">{children}</div>
      <div className="pp-rb-cap">{caption}</div>
    </div>
  );
}

/** A large (or small) ribbon command button: icon over label. */
export function RbBtn({
  icon,
  label,
  title,
  onClick,
  disabled,
  active,
  small,
}: {
  icon: ReactNode;
  label?: string;
  title?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  small?: boolean;
}): React.JSX.Element {
  return (
    <Tooltip title={title ?? label}>
      <button
        type="button"
        className={`pp-rb-btn${small ? ' pp-rb-btn--sm' : ''}${active ? ' is-active' : ''}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={label ?? (typeof title === 'string' ? title : undefined)}
      >
        <span className="pp-rb-btn__icon">{icon}</span>
        {label && <span className="pp-rb-btn__label">{label}</span>}
      </button>
    </Tooltip>
  );
}

export const RbSep = (): React.JSX.Element => <div className="pp-rb-sep" />;
