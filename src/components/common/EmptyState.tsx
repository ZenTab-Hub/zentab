import { type LucideIcon, Database, Search, FileJson, Table, BarChart3, Activity, Radio, Key, Inbox, FolderOpen } from 'lucide-react'
import { cn } from '@/utils/cn'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
  compact?: boolean
}

export const EmptyState = ({ icon: Icon = Inbox, title, description, action, className, compact }: EmptyStateProps) => (
  <div className={cn(
    'flex flex-col items-center justify-center text-center',
    compact ? 'py-6 px-4' : 'py-12 px-6',
    className
  )}>
    <div className={cn(
      'rounded-full bg-muted/50 flex items-center justify-center mb-3',
      compact ? 'w-10 h-10' : 'w-14 h-14'
    )}>
      <Icon className={cn('text-muted-foreground/50', compact ? 'h-5 w-5' : 'h-7 w-7')} />
    </div>
    <h3 className={cn('font-medium text-foreground/80', compact ? 'text-xs mb-0.5' : 'text-sm mb-1')}>
      {title}
    </h3>
    {description && (
      <p className={cn('text-muted-foreground max-w-xs', compact ? 'text-[10px]' : 'text-xs')}>
        {description}
      </p>
    )}
    {action && (
      <button
        onClick={action.onClick}
        className={cn(
          'mt-3 inline-flex items-center gap-1.5 font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
          compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'
        )}
      >
        {action.label}
      </button>
    )}
  </div>
)

/* ─── Pre-configured empty states for common scenarios ─── */

export const NoDocuments = ({ onRefresh }: { onRefresh?: () => void }) => (
  <EmptyState
    icon={FolderOpen}
    title="No documents found"
    description="This collection appears to be empty, or no documents match your current filter."
    action={onRefresh ? { label: 'Refresh', onClick: onRefresh } : undefined}
  />
)

export const NoResults = () => (
  <EmptyState
    icon={Search}
    title="No results to display"
    description="Run a query to see results here."
  />
)

export const NoConnection = () => (
  <EmptyState
    icon={Database}
    title="No connection selected"
    description="Select a database connection from the sidebar to get started."
  />
)

export const NoSchema = ({ collection, onAnalyze }: { collection?: string; onAnalyze?: () => void }) => (
  <EmptyState
    icon={FileJson}
    title="No schema analysis yet"
    description={collection ? `Click "Analyze" to view schema for ${collection}` : 'Select a collection and click Analyze'}
    action={onAnalyze ? { label: 'Analyze Schema', onClick: onAnalyze } : undefined}
  />
)

export const NoStats = () => (
  <EmptyState
    icon={Activity}
    title="Loading server stats..."
    description="Fetching real-time metrics from the database server."
  />
)

export const NoTopics = ({ onCreate }: { onCreate?: () => void }) => (
  <EmptyState
    icon={Radio}
    title="No topics found"
    description="Create a topic to get started with Kafka messaging."
    action={onCreate ? { label: 'Create Topic', onClick: onCreate } : undefined}
  />
)

export const NoConsumerGroups = () => (
  <EmptyState
    icon={Key}
    title="No consumer groups found"
    description="Consumer groups will appear here when consumers connect to topics."
  />
)

export const NoTables = () => (
  <EmptyState
    icon={Table}
    title="No tables found"
    description="Create a table to get started."
    compact
  />
)

export const NoChartData = () => (
  <EmptyState
    icon={BarChart3}
    title="No data to visualize"
    description="Run a query that returns data to create charts."
    compact
  />
)

