import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  emoji?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

const EmptyState = ({ icon, emoji, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {icon ? (
      <div className="mb-4 text-muted-foreground">{icon}</div>
    ) : emoji ? (
      <span className="mb-4 text-5xl">{emoji}</span>
    ) : null}
    <h3 className="font-heading text-lg font-semibold">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
