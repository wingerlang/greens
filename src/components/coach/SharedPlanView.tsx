import React, { useState } from "react";
import { useCoachAthlete } from "../context/CoachAthleteContext.tsx";
import { Comment as CommentType, PlannedActivity } from "../models/types.ts";

interface SharedPlanViewProps {
  activities: PlannedActivity[];
  planId: string;
  planOwnerName?: string;
  isReadOnly?: boolean;
}

export function SharedPlanView(
  { activities, planId, planOwnerName = "Coach", isReadOnly = true }:
    SharedPlanViewProps,
) {
  const { addComment, getCommentsFor, mode, notifications } = useCoachAthlete();
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null,
  );
  const [newComment, setNewComment] = useState("");

  const comments = getCommentsFor("plan", planId);
  const activityComments = selectedActivityId
    ? getCommentsFor("activity", selectedActivityId)
    : [];

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const targetType = selectedActivityId ? "activity" : "plan";
    const targetId = selectedActivityId || planId;
    addComment(targetType, targetId, newComment);
    setNewComment("");
  };

  const weeks = React.useMemo(() => {
    if (activities.length === 0) return [];
    const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date));
    const groups: PlannedActivity[][] = [];
    let currentWeek: PlannedActivity[] = [];
    let lastWeekNum = -1;
    sorted.forEach((act) => {
      const date = new Date(act.date);
      const weekNum = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000));
      if (lastWeekNum !== -1 && weekNum !== lastWeekNum) {
        groups.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(act);
      lastWeekNum = weekNum;
    });
    if (currentWeek.length > 0) groups.push(currentWeek);
    return groups;
  }, [activities]);

  const CommentCard = ({ comment }: { comment: CommentType }) => (
    <div
      className={`p-3 rounded-xl ${
        comment.authorRole === "coach"
          ? "bg-amber-500/10 border-l-2 border-amber-500"
          : "bg-indigo-500/10 border-l-2 border-indigo-500"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`text-[9px] font-black uppercase ${
            comment.authorRole === "coach"
              ? "text-amber-400"
              : "text-indigo-400"
          }`}
        >
          {comment.authorRole === "coach" ? "👨‍🏫" : "🏃"} {comment.authorName}
        </span>
        <span className="text-[8px] text-slate-600">
          {new Date(comment.createdAt).toLocaleDateString("sv-SE")}
        </span>
      </div>
      <p className="text-sm text-slate-300">{comment.content}</p>
    </div>
  );

  return (
    <div className="shared-plan-view text-white">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase rounded-full">
              📤 Delad Plan
            </span>
            {isReadOnly && (
              <span className="px-2 py-0.5 bg-slate-700 text-slate-400 text-[9px] font-black uppercase rounded-full">
                Skrivskyddad
              </span>
            )}
          </div>
          <h2 className="text-xl font-black uppercase italic tracking-tighter mt-2">
            Träningsplan
          </h2>
          <p className="text-[10px] text-slate-500 font-bold">
            Från {planOwnerName}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-emerald-400">
            {activities.length}
          </div>
          <div className="text-[8px] text-slate-500 uppercase font-bold">
            Pass
          </div>
        </div>
      </div>

      {/* Plan Comments */}
      <div className="mb-6 p-4 glass-card border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            💬 Kommentarer ({comments.length})
          </h3>
        </div>
        {comments.length > 0 && (
          <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
            {comments.map((c) => <CommentCard key={c.id} comment={c} />)}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Skriv en kommentar..."
            className="flex-1 bg-slate-900/50 border border-white/5 rounded-xl p-2.5 text-sm text-white focus:border-indigo-500/50 outline-none"
          />
          <button
            onClick={handleAddComment}
            disabled={!newComment.trim()}
            className="px-4 py-2 bg-indigo-500 text-white font-black rounded-xl text-[9px] uppercase hover:bg-indigo-400 disabled:opacity-40 transition-all"
          >
            Skicka
          </button>
        </div>
      </div>

      {/* Weekly Plan View */}
      <div className="space-y-6">
        {weeks.map((week, wIdx) => {
          const weekVolume = week.reduce(
            (sum, a) => sum + (a.estimatedDistance || 0),
            0,
          );
          return (
            <div
              key={wIdx}
              className="p-4 rounded-2xl border border-white/5 bg-slate-900/30"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Vecka {wIdx + 1}
                </span>
                <span className="text-sm font-black text-emerald-400">
                  {Math.round(weekVolume)} km
                </span>
              </div>
              <div className="space-y-2">
                {week.map((activity) => {
                  const actComments = getCommentsFor("activity", activity.id);
                  return (
                    <div
                      key={activity.id}
                      className={`p-3 rounded-xl border ${
                        selectedActivityId === activity.id
                          ? "bg-indigo-500/10 border-indigo-500/30"
                          : "bg-slate-900/50 border-white/5"
                      } cursor-pointer hover:bg-white/[0.02] transition-all`}
                      onClick={() =>
                        setSelectedActivityId(
                          selectedActivityId === activity.id
                            ? null
                            : activity.id,
                        )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                              activity.category === "LONG_RUN"
                                ? "bg-amber-500/20 text-amber-400"
                                : activity.category === "INTERVALS"
                                ? "bg-rose-500/20 text-rose-400"
                                : "bg-indigo-500/20 text-indigo-400"
                            }`}
                          >
                            {activity.category === "LONG_RUN"
                              ? "🏃"
                              : activity.category === "INTERVALS"
                              ? "⚡"
                              : "🌿"}
                          </div>
                          <div>
                            <div className="text-xs font-black text-white">
                              {activity.title}
                            </div>
                            <div className="text-[9px] text-slate-500">
                              {activity.date} • {activity.estimatedDistance} km
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {actComments.length > 0 && (
                            <span className="text-[9px] text-indigo-400">
                              💬 {actComments.length}
                            </span>
                          )}
                          <span
                            className={`w-2 h-2 rounded-full ${
                              activity.status === "COMPLETED"
                                ? "bg-emerald-500"
                                : "bg-amber-500"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Activity Comments */}
                      {selectedActivityId === activity.id && (
                        <div className="mt-3 pt-3 border-t border-white/5 animate-in slide-in-from-top duration-200">
                          <p className="text-[10px] text-slate-400 italic mb-2">
                            "{activity.description}"
                          </p>
                          {actComments.length > 0 && (
                            <div className="space-y-2 mb-3">
                              {actComments.map((c) => (
                                <CommentCard key={c.id} comment={c} />
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              placeholder="Kommentera detta pass..."
                              className="flex-1 bg-slate-800 border border-white/5 rounded-lg p-2 text-[10px] text-white focus:border-indigo-500/50 outline-none"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddComment();
                              }}
                              className="px-3 py-1.5 bg-indigo-500 text-white font-black rounded-lg text-[8px] uppercase"
                            >
                              💬
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {activities.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm font-bold">Ingen plan delad än</p>
          <p className="text-[10px]">
            Din coach har inte skickat någon plan ännu
          </p>
        </div>
      )}
    </div>
  );
}
