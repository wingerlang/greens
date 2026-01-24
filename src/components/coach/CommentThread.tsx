import React, { useState } from "react";
import { Comment, generateId } from "../../models/types.ts";

interface CommentThreadProps {
  comments: Comment[];
  targetType: Comment["targetType"];
  targetId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: "coach" | "athlete";
  onAddComment: (content: string, parentId?: string) => void;
  onDeleteComment?: (commentId: string) => void;
}

export function CommentThread({
  comments,
  targetType,
  targetId,
  currentUserId,
  currentUserName,
  currentUserRole,
  onAddComment,
  onDeleteComment,
}: CommentThreadProps) {
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const rootComments = comments.filter((c) =>
    !c.parentId && c.targetType === targetType && c.targetId === targetId
  );
  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parentId === parentId);

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    onAddComment(newComment);
    setNewComment("");
  };

  const handleReply = (parentId: string) => {
    if (!replyContent.trim()) return;
    onAddComment(replyContent, parentId);
    setReplyContent("");
    setReplyingTo(null);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m sedan`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h sedan`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d sedan`;
    return d.toLocaleDateString("sv-SE");
  };

  const CommentCard = (
    { comment, depth = 0 }: { comment: Comment; depth?: number },
  ) => {
    const replies = getReplies(comment.id);
    const isOwn = comment.authorId === currentUserId;

    return (
      <div
        className={`${depth > 0 ? "ml-6 pl-4 border-l-2 border-white/5" : ""}`}
      >
        <div
          className={`p-3 rounded-xl mb-2 ${
            comment.authorRole === "coach"
              ? "bg-amber-500/5 border border-amber-500/10"
              : "bg-indigo-500/5 border border-indigo-500/10"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  comment.authorRole === "coach"
                    ? "bg-amber-500/20"
                    : "bg-indigo-500/20"
                }`}
              >
                {comment.authorRole === "coach" ? "👨‍🏫" : "🏃"}
              </span>
              <span
                className={`text-[10px] font-black uppercase ${
                  comment.authorRole === "coach"
                    ? "text-amber-400"
                    : "text-indigo-400"
                }`}
              >
                {comment.authorName}
              </span>
              <span className="text-[9px] text-slate-600">
                {formatDate(comment.createdAt)}
              </span>
              {comment.isEdited && (
                <span className="text-[8px] text-slate-600 italic">
                  (redigerad)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isOwn && onDeleteComment && (
                <button
                  onClick={() => onDeleteComment(comment.id)}
                  className="text-[9px] text-slate-600 hover:text-rose-400 transition-colors"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            {comment.content}
          </p>

          {/* Reactions */}
          {comment.reactions && comment.reactions.length > 0 && (
            <div className="flex gap-1 mt-2">
              {comment.reactions.map((r, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 bg-slate-800 rounded-md text-[10px]"
                >
                  {r.emoji} {r.count}
                </span>
              ))}
            </div>
          )}

          {/* Reply button */}
          {depth < 2 && (
            <button
              onClick={() =>
                setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              className="text-[9px] text-slate-500 hover:text-indigo-400 font-bold uppercase mt-2 transition-colors"
            >
              💬 Svara
            </button>
          )}
        </div>

        {/* Reply input */}
        {replyingTo === comment.id && (
          <div className="ml-6 mb-3 flex gap-2 animate-in slide-in-from-top duration-200">
            <input
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Skriv ett svar..."
              className="flex-1 bg-slate-900 border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500/50 outline-none"
              autoFocus
            />
            <button
              onClick={() => handleReply(comment.id)}
              disabled={!replyContent.trim()}
              className="px-3 py-2 bg-indigo-500 text-white font-bold rounded-lg text-[9px] uppercase hover:bg-indigo-400 disabled:opacity-40 transition-all"
            >
              Svara
            </button>
          </div>
        )}

        {/* Nested replies */}
        {replies.map((reply) => (
          <CommentCard key={reply.id} comment={reply} depth={depth + 1} />
        ))}
      </div>
    );
  };

  return (
    <div className="comment-thread space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          💬 Kommentarer ({rootComments.length})
        </h4>
      </div>

      {/* New comment input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Skriv en kommentar..."
          className="flex-1 bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500/50 outline-none"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim()}
          className="px-4 py-3 bg-indigo-500 text-white font-black rounded-xl text-[9px] uppercase tracking-widest hover:bg-indigo-400 disabled:opacity-40 transition-all"
        >
          Skicka
        </button>
      </div>

      {/* Comments list */}
      <div className="space-y-2">
        {rootComments.length === 0
          ? (
            <p className="text-center text-slate-600 text-sm py-6">
              Inga kommentarer ännu. Var först!
            </p>
          )
          : (
            rootComments.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))
          )}
      </div>
    </div>
  );
}
