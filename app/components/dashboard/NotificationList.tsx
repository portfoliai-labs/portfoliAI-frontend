"use client";

import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, Clock, Bell } from "lucide-react";
import type { NotificationResponse } from "../../services/notificationService";

interface NotificationListProps {
  notifications: NotificationResponse[];
  isLoading: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type JobStatus = "QUEUED" | "PROCESSING" | "SUCCESS" | "FAILED";

const STATUS_CONFIG: Record<JobStatus, {
  label: string;
  icon: React.ReactNode;
  pill: string;
}> = {
  SUCCESS: {
    label: "Completed",
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  FAILED: {
    label: "Failed",
    icon: <XCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    pill: "bg-rose-50 text-rose-700 border-rose-200",
  },
  PROCESSING: {
    label: "Processing",
    icon: <Loader2 className="w-5 h-5 text-amber-500 shrink-0 animate-spin" />,
    pill: "bg-amber-50 text-amber-700 border-amber-200",
  },
  QUEUED: {
    label: "Queued",
    icon: <Clock className="w-5 h-5 text-[#a8a29e] shrink-0" />,
    pill: "bg-stone-50 text-stone-600 border-stone-200",
  },
};

const DEFAULT_STATUS_CONFIG = {
  label: "Notification",
  icon: <Bell className="w-5 h-5 text-[#C49A3C] shrink-0" />,
  pill: "bg-[#F7F5EF] text-[#78716c] border-[rgba(196,154,60,0.25)]",
};

function getJobStatus(n: NotificationResponse) {
  const status = n.payload?.status as string | undefined;
  if (status && status in STATUS_CONFIG) return STATUS_CONFIG[status as JobStatus];
  return DEFAULT_STATUS_CONFIG;
}

function getJobId(n: NotificationResponse): string | undefined {
  return n.payload?.job_id as string | undefined;
}

function getDocumentId(n: NotificationResponse): string | undefined {
  return n.payload?.document_id as string | undefined;
}

function getErrorMessage(n: NotificationResponse): string | undefined {
  return n.payload?.error_message as string | undefined;
}

function getReportName(n: NotificationResponse): string | undefined {
  return n.payload?.report_name as string | undefined;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

// Shared body markup for the notifications list — used by both the desktop
// header dropdown (NotificationPanel) and the full-page mobile view
// (NotificationsSection), so the two stay visually and behaviorally in sync.
export function NotificationList({ notifications, isLoading }: NotificationListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-[#a8a29e]">
        <Bell className="w-8 h-8 opacity-30" />
        <p className="text-sm font-medium">No notifications yet</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[rgba(196,154,60,0.1)]">
      {notifications.map((n) => {
        const cfg = getJobStatus(n);
        const jobId = getJobId(n);
        const documentId = getDocumentId(n);
        const errorMessage = getErrorMessage(n);
        const reportName = getReportName(n);
        const isUnread = n.read_at === null;

        return (
          <li
            key={n.notification_id}
            className={`flex items-start gap-3 px-5 py-4 transition-colors ${
              isUnread ? "bg-white/50" : "hover:bg-white/40"
            }`}
          >
            {cfg.icon}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-[#1c1917] truncate flex items-center gap-1.5">
                  {isUnread && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C49A3C] shrink-0" />
                  )}
                  {reportName || "Report job"}
                </span>
                <span className="text-[10px] text-[#a8a29e] shrink-0">
                  {formatDate(n.created_at)}
                </span>
              </div>
              {jobId && !documentId && !reportName && (
                <p className="text-[11px] text-[#78716c] truncate mb-2">
                  ID: {jobId}
                </p>
              )}
              {errorMessage && (
                <p className="text-[11px] text-rose-600 mb-2">
                  {errorMessage}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.pill}`}
                >
                  {cfg.label}
                </span>
                {documentId && (
                  <Link
                    href={`/reports/${documentId}`}
                    target="_blank"
                    className="text-[10px] font-bold text-[#C49A3C] hover:text-[#a87f2f] underline underline-offset-2"
                  >
                    View report
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
