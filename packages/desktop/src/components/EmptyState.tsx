import { InboxOutlined } from '@ant-design/icons';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** A friendly, centered empty placeholder (icon + message + optional CTA) used
 *  by the shared grid and detail views instead of a bare "no data" line. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon ?? <InboxOutlined />}</div>
      <div className="empty-state__title">{title}</div>
      {description && <div className="empty-state__desc">{description}</div>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
