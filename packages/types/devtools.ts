/**
 * DevTools Types
 * Type definitions for development tools and debugging features
 */

export interface DevToolsConfig {
  enabled: boolean;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  expanded: boolean;
  tabs: DevToolsTab[];
}

export interface DevToolsTab {
  id: string;
  label: string;
  active: boolean;
}

export interface SystemStats {
  totalUsers: number;
  totalOrganizations: number;
  totalSyncs: number;
  totalOrders: number;
  activeSyncs: number;
  failedSyncs: number;
}

export interface Organization {
  id: string;
  name: string;
  plan: string;
  createdAt: number;
  memberCount: number;
  owner: {
    id: string;
    name?: string;
    email: string;
  } | null;
}

export interface SyncSession {
  _id: string;
  organizationId: string;
  platform: string;
  syncType: string;
  status: "pending" | "syncing" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  progress?: number;
  recordsProcessed?: number;
  error?: string;
}

export interface JobQueueStatus {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  avgProcessingTime: number;
  oldestJob?: {
    id: string;
    createdAt: number;
    handler: string;
  };
}

export interface WebhookLog {
  _id: string;
  platform: string;
  topic: string;
  status: "pending" | "processing" | "processed" | "failed";
  receivedAt: number;
  processedAt?: number;
  error?: string;
  payload?: Record<string, unknown>;
}

export interface ActivityLog {
  timestamp: number;
  userId: string;
  action: string;
  details?: Record<string, unknown>;
}

export interface CacheStatus {
  entries: number;
  size: number;
  hitRate: number;
  missRate: number;
}

export interface DebugMessage {
  level: "info" | "warning" | "error" | "debug";
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  threshold?: number;
  status: "good" | "warning" | "critical";
}

export interface DevToolsState {
  systemStats: SystemStats | null;
  organizations: Organization[];
  syncSessions: SyncSession[];
  jobQueueStatus: JobQueueStatus | null;
  webhookLogs: WebhookLog[];
  activityLogs: ActivityLog[];
  cacheStatus: CacheStatus | null;
  debugMessages: DebugMessage[];
  performanceMetrics: PerformanceMetric[];
  isLoading: boolean;
  error: string | null;
}

export interface DevToolsAction {
  type: string;
  label: string;
  icon?: string;
  action: () => void | Promise<void>;
  dangerous?: boolean;
  requiresConfirmation?: boolean;
}

export interface DevToolsFilter {
  field: string;
  operator: "equals" | "contains" | "gt" | "lt" | "between";
  value: string | number | boolean;
}

export interface DevToolsSort {
  field: string;
  direction: "asc" | "desc";
}

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning";
}
