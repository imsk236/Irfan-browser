import { useEffect, useState, useCallback } from "react";
import {
  Books, TextAlignLeft, Users, Note, Buildings,
  ArrowLeft, Circle, X,
} from "@phosphor-icons/react";
import { dashboardApi } from "../../api";
import type {
  DashboardStats, ActivityDay, DayDetail, RecentEdit,
  ActionableCounts, RepositoryCount,
} from "../../api/types";
import type { Screen } from "../../components/Navigation";

// ── helpers ──────────────────────────────────────────────────────────────────

function todayMuscat(): string {
  return new Date(Date.now() + 4 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function buildCalendarGrid(activityDays: ActivityDay[]) {
  const activityMap = new Map(activityDays.map((d) => [d.date, d.count]));

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 364);

  // Align to the Sunday on or before startDate
  const dayOfWeek = startDate.getDay();
  startDate.setDate(startDate.getDate() - dayOfWeek);

  type CellData = { date: string; count: number; inRange: boolean };
  type Week = { days: CellData[]; monthLabel: string | null };

  const weeks: Week[] = [];
  const current = new Date(startDate);
  let lastMonth = -1;

  while (current <= today) {
    const week: CellData[] = [];
    const weekMonthAtStart = current.getMonth();
    const monthLabel =
      weekMonthAtStart !== lastMonth
        ? current.toLocaleDateString("ar-SA", { month: "short" })
        : null;
    if (monthLabel) lastMonth = weekMonthAtStart;

    for (let i = 0; i < 7; i++) {
      const dateStr = current.toISOString().slice(0, 10);
      const inRange = current >= startDate && current <= today;
      week.push({ date: dateStr, count: inRange ? (activityMap.get(dateStr) ?? 0) : -1, inRange });
      current.setDate(current.getDate() + 1);
    }
    weeks.push({ days: week, monthLabel });
  }

  return weeks;
}

function cellColor(count: number): string {
  if (count < 0) return "transparent";
  if (count === 0) return "var(--color-border)";
  if (count === 1) return "var(--color-primary-700)";
  if (count === 2) return "var(--color-warning)";
  return "var(--color-danger)";
}

const TABLE_LABELS: Record<string, string> = {
  volumes: "مجلد",
  works: "عنوان",
  annotations: "قيد",
  persons: "شخص",
  repositories: "خزانة",
  person_relationships: "ربط",
};

const ACTION_LABELS: Record<string, string> = {
  create: "أُنشئ",
  update: "عُدِّل",
  delete: "حُذف",
};

const ACTION_COLORS: Record<string, string> = {
  create: "var(--color-primary-700)",
  update: "var(--color-info)",
  delete: "var(--color-danger)",
};

const TABLE_ICONS: Record<string, React.ElementType> = {
  volumes: Books,
  works: TextAlignLeft,
  annotations: Note,
  persons: Users,
  repositories: Buildings,
  person_relationships: Circle,
};

function formatRelativeTime(isoUtc: string): string {
  const diff = Date.now() - new Date(isoUtc).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days} يوم`;
  const weeks = Math.floor(days / 7);
  return `منذ ${weeks} أسبوع`;
}

function formatMuscatTime(isoUtc: string): string {
  try {
    return new Date(isoUtc).toLocaleTimeString("ar-SA", {
      timeZone: "Asia/Muscat",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoUtc.slice(11, 16);
  }
}

function formatMuscatDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("ar-SA", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ── sub-components ────────────────────────────────────────────────────────────

function SkeletonBar({ width = "100%", height = 14 }: { width?: string | number; height?: number }) {
  return (
    <div
      style={{
        width, height, borderRadius: "var(--radius-sm)",
        background: "var(--color-surface-muted)",
        animation: "pulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

function StatsStrip({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  const items = [
    { label: "المجلدات", key: "volumes" as const, Icon: Books },
    { label: "الأعمال", key: "works" as const, Icon: TextAlignLeft },
    { label: "الأشخاص", key: "persons" as const, Icon: Users },
    { label: "القيود", key: "annotations" as const, Icon: Note },
    { label: "الخزائن", key: "repositories" as const, Icon: Buildings },
  ];

  return (
    <div
      style={{
        display: "flex", gap: 0,
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      {items.map(({ label, key, Icon }, idx) => (
        <div
          key={key}
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: "var(--space-3)",
            padding: "var(--space-4) var(--space-5)",
            borderInlineStart: idx > 0 ? "1px solid var(--color-border)" : "none",
          }}
        >
          <Icon size={16} weight="regular" color="var(--color-text-muted)" aria-hidden />
          <div>
            <div style={{ fontSize: "var(--font-size-meta)", color: "var(--color-text-muted)", marginBottom: 2 }}>
              {label}
            </div>
            {loading ? (
              <SkeletonBar width={32} height={18} />
            ) : (
              <div style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text)", lineHeight: 1.1 }}>
                {stats?.[key].toLocaleString("ar-SA") ?? "—"}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityCalendar({
  days,
  loading,
  onDayClick,
  selectedDate,
}: {
  days: ActivityDay[];
  loading: boolean;
  onDayClick: (date: string) => void;
  selectedDate: string | null;
}) {
  const weeks = buildCalendarGrid(days);
  const CELL = 13;
  const GAP = 3;
  const CELL_PLUS_GAP = CELL + GAP;

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <SkeletonBar width={160} height={13} />
        <div style={{ height: 7 * CELL_PLUS_GAP, borderRadius: "var(--radius-sm)", background: "var(--color-surface-muted)", animation: "pulse 1.4s ease-in-out infinite" }} />
      </div>
    );
  }

  return (
    <div>
      {/* Calendar grid — direction:ltr so oldest=left, newest=right */}
      <div style={{ direction: "ltr", overflowX: "auto", paddingBottom: "var(--space-1)" }}>
        <div style={{ display: "inline-flex", flexDirection: "column", gap: 0 }}>
          {/* Month labels row */}
          <div style={{ display: "flex", marginBottom: 4, gap: GAP }}>
            {weeks.map((week, wi) => (
              <div
                key={wi}
                style={{
                  width: CELL, fontSize: 9,
                  color: "var(--color-text-muted)",
                  overflow: "visible", whiteSpace: "nowrap",
                  textAlign: "left",
                }}
              >
                {week.monthLabel ?? ""}
              </div>
            ))}
          </div>
          {/* Day rows */}
          {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
            <div key={dayIndex} style={{ display: "flex", gap: GAP, marginBottom: GAP }}>
              {weeks.map((week, wi) => {
                const cell = week.days[dayIndex];
                const isSelected = cell.date === selectedDate;
                return (
                  <button
                    key={wi}
                    title={cell.inRange ? `${cell.date}: ${cell.count} حفظة` : ""}
                    disabled={!cell.inRange || cell.count < 0}
                    onClick={() => cell.inRange && onDayClick(cell.date)}
                    aria-label={cell.inRange ? `${cell.date}، ${cell.count} نشاط` : undefined}
                    aria-pressed={isSelected}
                    style={{
                      width: CELL, height: CELL,
                      borderRadius: 2,
                      border: isSelected ? "2px solid var(--color-text)" : "none",
                      background: cellColor(cell.count),
                      cursor: cell.inRange && cell.count >= 0 ? "pointer" : "default",
                      padding: 0, flexShrink: 0,
                      transition: "opacity var(--transition-fast)",
                      opacity: cell.inRange ? 1 : 0,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: "var(--space-3)", fontSize: "var(--font-size-meta)", color: "var(--color-text-muted)" }}>
        <span>أقل</span>
        {[0, 1, 2, 3].map((v) => (
          <div
            key={v}
            style={{ width: CELL, height: CELL, borderRadius: 2, background: cellColor(v), flexShrink: 0 }}
          />
        ))}
        <span>أكثر</span>
      </div>
    </div>
  );
}

function DayDetailPanel({
  date,
  detail,
  loading,
  onClose,
  onNavigate,
}: {
  date: string;
  detail: DayDetail | null;
  loading: boolean;
  onClose: () => void;
  onNavigate: (screen: Screen, recordId?: number) => void;
}) {
  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.25)",
          zIndex: 40,
          animation: "fadeIn 160ms ease",
        }}
      />
      {/* panel — anchored to right side in screen coords */}
      <div
        style={{
          position: "fixed", top: 0, left: 0,
          width: 380, height: "100vh",
          background: "var(--color-surface)",
          boxShadow: "var(--shadow-panel)",
          zIndex: 41,
          display: "flex", flexDirection: "column",
          animation: "slideInFromLeft 200ms ease",
          overflow: "hidden",
        }}
        role="dialog"
        aria-label={`سجل يوم ${date}`}
      >
        {/* panel header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "var(--font-size-panel)", color: "var(--color-text)" }}>
              سجل يوم
            </div>
            <div style={{ fontSize: "var(--font-size-label)", color: "var(--color-text-muted)", marginTop: 2 }}>
              {formatMuscatDate(date)}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--color-text-muted)", padding: "var(--space-1)",
              borderRadius: "var(--radius-sm)",
              display: "flex", alignItems: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* panel body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4) var(--space-5)" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  <SkeletonBar width={80} height={12} />
                  <SkeletonBar height={13} />
                  <SkeletonBar width="70%" height={13} />
                </div>
              ))}
            </div>
          ) : !detail || detail.commits.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "var(--space-8) 0", fontSize: "var(--font-size-body)" }}>
              لا يوجد نشاط مسجل لهذا اليوم
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
              {detail.commits.map((commit) => (
                <div key={commit.commit_id}>
                  <div style={{
                    fontSize: "var(--font-size-meta)", color: "var(--color-text-muted)",
                    marginBottom: "var(--space-2)",
                    fontVariantNumeric: "tabular-nums",
                    direction: "ltr", textAlign: "right",
                  }}>
                    {formatMuscatTime(commit.occurred_at)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    {commit.entries.map((entry) => {
                      const Icon = TABLE_ICONS[entry.table_name] ?? Circle;
                      const canNavigate = ["volumes", "persons"].includes(entry.table_name) && entry.action !== "delete";
                      return (
                        <div
                          key={entry.id}
                          style={{
                            display: "flex", alignItems: "center", gap: "var(--space-2)",
                            padding: "var(--space-2) var(--space-3)",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--color-page)",
                          }}
                        >
                          <Icon size={13} color="var(--color-text-muted)" aria-hidden />
                          <span style={{ fontSize: "var(--font-size-meta)", color: "var(--color-text-muted)", flexShrink: 0 }}>
                            {TABLE_LABELS[entry.table_name] ?? entry.table_name}
                          </span>
                          <span
                            style={{
                              flex: 1, fontSize: "var(--font-size-body)",
                              color: "var(--color-text)", overflow: "hidden",
                              textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}
                          >
                            {entry.label ?? `#${entry.record_id}`}
                          </span>
                          <span style={{ fontSize: "var(--font-size-meta)", color: ACTION_COLORS[entry.action], flexShrink: 0 }}>
                            {ACTION_LABELS[entry.action] ?? entry.action}
                          </span>
                          {canNavigate && (
                            <button
                              onClick={() => onNavigate(entry.table_name === "volumes" ? "volumes" : "persons", entry.record_id)}
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "var(--color-text-muted)", padding: 0,
                                display: "flex", alignItems: "center",
                              }}
                              title="انتقل إلى السجل"
                            >
                              <ArrowLeft size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function RecentEditsSection({
  edits,
  loading,
  onNavigate,
}: {
  edits: RecentEdit[];
  loading: boolean;
  onNavigate: (screen: Screen, recordId?: number) => void;
}) {
  return (
    <section>
      <h2 style={{
        fontSize: "var(--font-size-label)", fontWeight: 600,
        color: "var(--color-text-muted)", textTransform: "uppercase",
        letterSpacing: "0.06em", marginBottom: "var(--space-3)",
      }}>
        آخر التعديلات
      </h2>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {[1, 2, 3, 4, 5].map((i) => <SkeletonBar key={i} height={36} />)}
        </div>
      ) : edits.length === 0 ? (
        <div style={{
          padding: "var(--space-5)",
          textAlign: "center",
          color: "var(--color-text-muted)",
          fontSize: "var(--font-size-body)",
          borderRadius: "var(--radius-md)",
          background: "var(--color-surface-muted)",
        }}>
          لا يوجد نشاط مسجل بعد
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {edits.map((edit, i) => {
            const Icon = TABLE_ICONS[edit.table_name] ?? Circle;
            const canNavigate = ["volumes", "persons"].includes(edit.table_name) && edit.action !== "delete";
            return (
              <div
                key={`${edit.table_name}-${edit.record_id}`}
                style={{
                  display: "flex", alignItems: "center", gap: "var(--space-3)",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  background: i % 2 === 0 ? "var(--color-page)" : "transparent",
                }}
              >
                <Icon size={14} color="var(--color-text-muted)" aria-hidden />
                <span style={{
                  flex: 1, fontSize: "var(--font-size-body)", color: "var(--color-text)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {edit.label ?? `#${edit.record_id}`}
                </span>
                <span style={{
                  fontSize: "var(--font-size-meta)",
                  color: ACTION_COLORS[edit.action],
                  flexShrink: 0,
                }}>
                  {ACTION_LABELS[edit.action] ?? edit.action}
                </span>
                <span style={{
                  fontSize: "var(--font-size-meta)", color: "var(--color-text-muted)",
                  flexShrink: 0, minWidth: 64, textAlign: "start",
                }}>
                  {formatRelativeTime(edit.occurred_at)}
                </span>
                {canNavigate && (
                  <button
                    onClick={() => onNavigate(edit.table_name === "volumes" ? "volumes" : "persons", edit.record_id)}
                    title="انتقل إلى السجل"
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--color-text-muted)", padding: 0,
                      display: "flex", alignItems: "center",
                      opacity: 0.6,
                    }}
                  >
                    <ArrowLeft size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ActionableSection({
  counts,
  loading,
  onNavigate,
}: {
  counts: ActionableCounts | null;
  loading: boolean;
  onNavigate: (screen: Screen) => void;
}) {
  const items = [
    {
      key: "incomplete_volumes" as const,
      label: "مجلدات بلا عدد أوراق",
      screen: "volumes" as Screen,
    },
    {
      key: "incomplete_works" as const,
      label: "أعمال بلا تاريخ نسخ",
      screen: "volumes" as Screen,
    },
    {
      key: "weak_evidence" as const,
      label: "روابط بلا مصدر",
      screen: "volumes" as Screen,
    },
    {
      key: "orphan_persons" as const,
      label: "أشخاص بلا ظهورات",
      screen: "persons" as Screen,
    },
  ];

  return (
    <section>
      <h2 style={{
        fontSize: "var(--font-size-label)", fontWeight: 600,
        color: "var(--color-text-muted)", textTransform: "uppercase",
        letterSpacing: "0.06em", marginBottom: "var(--space-3)",
      }}>
        تحتاج إلى عمل
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {items.map(({ key, label, screen }) => {
          const value = counts?.[key] ?? null;
          const hasIssues = value !== null && value > 0;
          return (
            <div
              key={key}
              style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-sm)",
                cursor: hasIssues ? "pointer" : "default",
              }}
              onClick={hasIssues ? () => onNavigate(screen) : undefined}
              role={hasIssues ? "button" : undefined}
              tabIndex={hasIssues ? 0 : undefined}
              onKeyDown={hasIssues ? (e) => e.key === "Enter" && onNavigate(screen) : undefined}
            >
              <span style={{ fontSize: "var(--font-size-body)", color: "var(--color-text)" }}>
                {label}
              </span>
              {loading ? (
                <SkeletonBar width={24} height={13} />
              ) : (
                <span style={{
                  fontSize: "var(--font-size-label)", fontWeight: 600,
                  color: hasIssues ? "var(--color-danger)" : "var(--color-text-muted)",
                  minWidth: 24, textAlign: "center",
                }}>
                  {value?.toLocaleString("ar-SA") ?? "—"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RepositoryBars({
  repos,
  loading,
}: {
  repos: RepositoryCount[];
  loading: boolean;
}) {
  const max = repos.reduce((m, r) => Math.max(m, r.volume_count), 0) || 1;

  return (
    <section>
      <h2 style={{
        fontSize: "var(--font-size-label)", fontWeight: 600,
        color: "var(--color-text-muted)", textTransform: "uppercase",
        letterSpacing: "0.06em", marginBottom: "var(--space-3)",
      }}>
        توزيع المجلدات
      </h2>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {[1, 2, 3].map((i) => <SkeletonBar key={i} height={32} />)}
        </div>
      ) : repos.length === 0 ? (
        <div style={{
          fontSize: "var(--font-size-body)", color: "var(--color-text-muted)",
          textAlign: "center", padding: "var(--space-4)",
        }}>
          لا توجد خزائن
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {repos.map((repo) => (
            <div key={repo.id}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: "var(--font-size-label)", marginBottom: "var(--space-1)",
              }}>
                <span style={{ color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {repo.name}
                </span>
                <span style={{ color: "var(--color-text-muted)", flexShrink: 0, marginInlineStart: "var(--space-2)" }}>
                  {repo.volume_count.toLocaleString("ar-SA")}
                </span>
              </div>
              <div style={{
                height: 6, borderRadius: 3,
                background: "var(--color-surface-muted)",
                overflow: "hidden",
              }}>
                <div
                  style={{
                    height: "100%",
                    width: "100%",
                    background: "var(--color-primary-700)",
                    borderRadius: 3,
                    transformOrigin: "right center",
                    transform: `scaleX(${repo.volume_count / max})`,
                    transition: "transform 400ms ease",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function DashboardScreen({ onNavigate }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activityDays, setActivityDays] = useState<ActivityDay[]>([]);
  const [recentEdits, setRecentEdits] = useState<RecentEdit[]>([]);
  const [actionable, setActionable] = useState<ActionableCounts | null>(null);
  const [repoCounts, setRepoCounts] = useState<RepositoryCount[]>([]);

  const [statsLoading, setStatsLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);
  const [actionableLoading, setActionableLoading] = useState(true);
  const [repoLoading, setRepoLoading] = useState(true);

  const [statsError, setStatsError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<DayDetail | null>(null);
  const [dayDetailLoading, setDayDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setStatsLoading(true);
    setCalendarLoading(true);
    setRecentLoading(true);
    setActionableLoading(true);
    setRepoLoading(true);

    const [
      statsResult,
      activityResult,
      recentResult,
      actionableResult,
      repoResult,
    ] = await Promise.allSettled([
      dashboardApi.stats(),
      dashboardApi.activity(),
      dashboardApi.recent(),
      dashboardApi.actionable(),
      dashboardApi.repositories(),
    ]);

    if (statsResult.status === "fulfilled") {
      setStats(statsResult.value);
    } else {
      setStatsError("تعذّر تحميل الإحصائيات");
    }
    setStatsLoading(false);

    if (activityResult.status === "fulfilled") {
      setActivityDays(activityResult.value.days);
    }
    setCalendarLoading(false);

    if (recentResult.status === "fulfilled") {
      setRecentEdits(recentResult.value);
    }
    setRecentLoading(false);

    if (actionableResult.status === "fulfilled") {
      setActionable(actionableResult.value);
    }
    setActionableLoading(false);

    if (repoResult.status === "fulfilled") {
      setRepoCounts(repoResult.value);
    }
    setRepoLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDayClick = useCallback(async (date: string) => {
    setSelectedDate(date);
    setDayDetail(null);
    setDayDetailLoading(true);
    try {
      const detail = await dashboardApi.dayDetail(date);
      setDayDetail(detail);
    } catch {
      setDayDetail({ date, commits: [] });
    } finally {
      setDayDetailLoading(false);
    }
  }, []);

  const handleDayDetailNavigate = useCallback((screen: Screen) => {
    setSelectedDate(null);
    onNavigate(screen);
  }, [onNavigate]);

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInFromLeft {
          from { transform: translateX(-24px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes pulse { 0%, 100% { opacity: 1; } }
          @keyframes slideInFromLeft { from { opacity: 0; } to { opacity: 1; } }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Screen header */}
        <div className="screen-header" style={{ flexShrink: 0 }}>
          <h1 className="screen-title">لوحة المتابعة</h1>
          {statsError && (
            <span style={{ fontSize: "var(--font-size-meta)", color: "var(--color-danger)" }}>
              {statsError}
            </span>
          )}
        </div>

        {/* Stats strip */}
        <StatsStrip stats={stats} loading={statsLoading} />

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 260px",
            gap: "var(--space-6)",
            padding: "var(--space-6)",
            maxWidth: "var(--content-max-width)",
            minHeight: "100%",
            boxSizing: "border-box",
          }}>
            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-7)", minWidth: 0 }}>
              {/* Activity calendar */}
              <section>
                <h2 style={{
                  fontSize: "var(--font-size-label)", fontWeight: 600,
                  color: "var(--color-text-muted)", textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: "var(--space-4)",
                }}>
                  نشاط التوثيق — ١٢ شهراً
                </h2>
                <ActivityCalendar
                  days={activityDays}
                  loading={calendarLoading}
                  onDayClick={handleDayClick}
                  selectedDate={selectedDate}
                />
                {!calendarLoading && activityDays.length === 0 && (
                  <div style={{
                    marginTop: "var(--space-3)",
                    fontSize: "var(--font-size-body)",
                    color: "var(--color-text-muted)",
                  }}>
                    سيظهر النشاط هنا بعد أول حفظ في الأرشيف.
                  </div>
                )}
              </section>

              {/* Recent edits */}
              <RecentEditsSection
                edits={recentEdits}
                loading={recentLoading}
                onNavigate={(screen) => { onNavigate(screen); }}
              />
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
              <ActionableSection
                counts={actionable}
                loading={actionableLoading}
                onNavigate={onNavigate}
              />
              <div style={{ height: 1, background: "var(--color-border)" }} />
              <RepositoryBars repos={repoCounts} loading={repoLoading} />
            </div>
          </div>
        </div>
      </div>

      {/* Day detail overlay */}
      {selectedDate && (
        <DayDetailPanel
          date={selectedDate}
          detail={dayDetail}
          loading={dayDetailLoading}
          onClose={() => setSelectedDate(null)}
          onNavigate={handleDayDetailNavigate}
        />
      )}
    </>
  );
}
