import React from 'react';
import { AlertTriangle, Clock, RefreshCw, Search, Check, X, ShieldAlert } from 'lucide-react';
import styles from './SystemStates.module.css';

// ─── 1. LOADING SKELETON / LOADING STATE ────────────────────────────────────
interface LoadingStateProps {
  title?: string;
  description?: string;
  type?: 'card' | 'table' | 'workspace' | 'analytics';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  title = "Loading information",
  description = "Fetching the latest response data...",
  type = "card"
}) => {
  return (
    <div className={styles.loadingContainer} role="status" aria-busy="true">
      <div className={styles.loadingHeader}>
        <RefreshCw className={styles.pulseIcon} size={18} />
        <div>
          <h3 className={styles.loadingTitle}>{title}</h3>
          <p className={styles.loadingDesc}>{description}</p>
        </div>
      </div>
      
      <div className={styles.skeletonWrapper}>
        {type === 'table' && (
          <div className={styles.tableSkeleton}>
            <div className={`${styles.skeletonLine} ${styles.headerLine}`} />
            {[1, 2, 3, 4].map(n => (
              <div key={n} className={styles.tableRowSkeleton}>
                <div className={`${styles.skeletonLine} ${styles.w20}`} />
                <div className={`${styles.skeletonLine} ${styles.w50}`} />
                <div className={`${styles.skeletonLine} ${styles.w15}`} />
                <div className={`${styles.skeletonLine} ${styles.w15}`} />
              </div>
            ))}
          </div>
        )}
        
        {type === 'card' && (
          <div className={styles.cardSkeletonGrid}>
            {[1, 2, 3].map(n => (
              <div key={n} className={styles.cardSkeleton}>
                <div className={`${styles.skeletonLine} ${styles.titleLine} ${styles.w40}`} />
                <div className={`${styles.skeletonLine} ${styles.w80}`} />
                <div className={`${styles.skeletonLine} ${styles.w60}`} />
                <div className={styles.cardSkeletonFooter}>
                  <div className={`${styles.skeletonLine} ${styles.w20}`} />
                  <div className={`${styles.skeletonLine} ${styles.w20}`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {type === 'workspace' && (
          <div className={styles.workspaceSkeleton}>
            <div className={styles.workspaceHeaderSkeleton}>
              <div className={`${styles.skeletonLine} ${styles.w30} ${styles.titleLine}`} />
              <div className={`${styles.skeletonLine} ${styles.w10}`} />
            </div>
            <div className={styles.workspaceBodySkeleton}>
              <div className={styles.workspaceLeftSkeleton}>
                <div className={`${styles.skeletonLine} ${styles.w100} ${styles.h30}`} />
                <div className={`${styles.skeletonLine} ${styles.w100} ${styles.h60}`} />
              </div>
              <div className={styles.workspaceRightSkeleton}>
                <div className={`${styles.skeletonLine} ${styles.w100} ${styles.h20}`} />
                <div className={`${styles.skeletonLine} ${styles.w100} ${styles.h40}`} />
              </div>
            </div>
          </div>
        )}

        {type === 'analytics' && (
          <div className={styles.analyticsSkeleton}>
            <div className={styles.analyticsStatsSkeleton}>
              {[1, 2, 3, 4].map(n => (
                <div key={n} className={styles.statBoxSkeleton}>
                  <div className={`${styles.skeletonLine} ${styles.w30}`} />
                  <div className={`${styles.skeletonLine} ${styles.w60} ${styles.titleLine}`} />
                </div>
              ))}
            </div>
            <div className={`${styles.skeletonLine} ${styles.w100} ${styles.h100}`} />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 2. EMPTY STATE ─────────────────────────────────────────────────────────
interface EmptyStateProps {
  title: string;
  description: string;
  iconType?: 'check' | 'info' | 'search';
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  iconType = 'info',
  actionLabel,
  onAction
}) => {
  return (
    <div className={styles.emptyContainer}>
      <div className={styles.iconWrap}>
        {iconType === 'check' && <Check className={styles.successIcon} size={24} />}
        {iconType === 'info' && <Clock className={styles.infoIcon} size={24} />}
        {iconType === 'search' && <Search className={styles.searchIcon} size={24} />}
      </div>
      <h3 className={styles.emptyTitle}>{title}</h3>
      <p className={styles.emptyDesc}>{description}</p>
      {actionLabel && onAction && (
        <button className={styles.actionBtn} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

// ─── 3. ERROR / FAILURE STATE ───────────────────────────────────────────────
interface ErrorStateProps {
  title: string;
  description: string;
  exceptionDetails?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  description,
  exceptionDetails,
  actionLabel = "Retry Operation",
  onAction
}) => {
  return (
    <div className={styles.errorContainer} role="alert">
      <div className={styles.errorIconWrap}>
        <AlertTriangle size={24} />
      </div>
      <h3 className={styles.errorTitle}>{title}</h3>
      <p className={styles.errorDesc}>{description}</p>
      
      {exceptionDetails && (
        <pre className={styles.exceptionLog}>
          <code>{exceptionDetails}</code>
        </pre>
      )}

      {onAction && (
        <button className={styles.errorActionBtn} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

// ─── 4. NO SEARCH RESULTS STATE ─────────────────────────────────────────────
interface NoResultsStateProps {
  query?: string;
  onClear: () => void;
}

export const NoResultsState: React.FC<NoResultsStateProps> = ({
  query,
  onClear
}) => {
  return (
    <div className={styles.emptyContainer}>
      <div className={styles.iconWrap}>
        <Search className={styles.searchIcon} size={24} />
      </div>
      <h3 className={styles.emptyTitle}>No matching results</h3>
      <p className={styles.emptyDesc}>
        {query ? `Your filter for "${query}" did not return any records.` : "No records match your active filtering parameters."}
      </p>
      <button className={styles.clearFiltersBtn} onClick={onClear}>
        Clear Active Filters
      </button>
    </div>
  );
};

// ─── 5. OFFLINE BANNERS & CONNECTION STATUS ─────────────────────────────────
interface ConnectionIndicatorProps {
  isOffline: boolean;
}

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({ isOffline }) => {
  return (
    <div className={`${styles.connIndicator} ${isOffline ? styles.connOffline : styles.connOnline}`}>
      <span className={styles.connDot} />
      <span className={styles.connLabel}>
        {isOffline ? 'CONNECTION LIMITED' : 'LIVE'}
      </span>
    </div>
  );
};

// ─── 6. TOAST MESSAGES SYSTEM ────────────────────────────────────────────────
export interface ToastMessage {
  id: string;
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  text: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;
  return (
    <div className={styles.toastContainer}>
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles['toast' + t.type]}`}>
          <div className={styles.toastContent}>
            {t.type === 'SUCCESS' && <Check className={styles.toastSuccessIcon} size={14} />}
            {t.type === 'ERROR' && <AlertTriangle className={styles.toastErrorIcon} size={14} />}
            {t.type === 'WARNING' && <ShieldAlert className={styles.toastWarnIcon} size={14} />}
            <span>{t.text}</span>
          </div>
          <button className={styles.toastClose} onClick={() => onRemove(t.id)}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};

// ─── 7. HIGH-IMPACT CONFIRMATION DIALOG ──────────────────────────────────────
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  stats?: { label: string; value: string | number }[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  stats,
  confirmLabel = "Confirm Action",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isProcessing = false
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.dialogOverlay} role="dialog" aria-modal="true">
      <div className={styles.dialogCard}>
        <div className={styles.dialogHeader}>
          <ShieldAlert className={styles.dialogAlertIcon} size={20} />
          <h3>{title}</h3>
        </div>
        <p className={styles.dialogMsg}>{message}</p>
        
        {stats && stats.length > 0 && (
          <div className={styles.dialogStatsGrid}>
            {stats.map((s, idx) => (
              <div key={idx} className={styles.dialogStatCell}>
                <span className={styles.dialogStatLabel}>{s.label}</span>
                <span className={styles.dialogStatVal}>{s.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.dialogActions}>
          <button 
            className={styles.dialogCancelBtn} 
            onClick={onCancel}
            disabled={isProcessing}
          >
            {cancelLabel}
          </button>
          <button 
            className={styles.dialogConfirmBtn} 
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
