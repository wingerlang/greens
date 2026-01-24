// Profile Feed Section - Shows user's own activity feed
import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useData } from "../../../context/DataContext.tsx";
import { FeedEventCard } from "../../feed/FeedEventCard.tsx";
import { aggregateFeedEvents } from "../../../api/services/feedAggregator.ts";
import type {
  FeedEvent,
  FeedEventCategory,
} from "../../../models/feedTypes.ts";

const CATEGORIES: { id: FeedEventCategory; label: string; icon: string }[] = [
  { id: "TRAINING", label: "Träning", icon: "🏋️" },
  { id: "NUTRITION", label: "Kost", icon: "🥗" },
  { id: "HEALTH", label: "Hälsa", icon: "😴" },
  { id: "SOCIAL", label: "Socialt", icon: "👥" },
];

interface ProfileFeedSectionProps {
  userId?: string; // If provided, filter to this user; otherwise use currentUser
  compact?: boolean; // Show fewer items initially
}

export function ProfileFeedSection(
  { userId, compact = true }: ProfileFeedSectionProps,
) {
  const { currentUser } = useData();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);
  const [activeCategories, setActiveCategories] = useState<FeedEventCategory[]>(
    ["TRAINING", "NUTRITION", "HEALTH", "SOCIAL"],
  );
  const [refreshing, setRefreshing] = useState(false);

  const targetUserId = userId || currentUser?.id;

  const fetchFeed = async () => {
    if (!targetUserId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const catParam = activeCategories.join(",");
      // Fetch feed filtered to this user only
      const res = await fetch(
        `/api/feed?limit=50&categories=${catParam}&userId=${targetUserId}`,
        {
          headers: { "Authorization": `Bearer ${token}` },
        },
      );

      if (res.ok) {
        const data = await res.json();
        // Filter client-side as well in case API doesn't support userId filter
        const userEvents = (data.events || []).filter((e: FeedEvent) =>
          e.userId === targetUserId
        );
        const aggregated = aggregateFeedEvents(userEvents);
        setEvents(aggregated);
      }
    } catch (err) {
      console.error("Failed to fetch profile feed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [activeCategories, targetUserId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  const toggleCategory = (cat: FeedEventCategory) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const displayedEvents = expanded ? events : events.slice(0, 5);

  return (
    <section className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>📡</span> Min Aktivitet
        </h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all ${
            refreshing ? "animate-spin" : ""
          }`}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => toggleCategory(cat.id)}
            className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all
                            ${
              activeCategories.includes(cat.id)
                ? "bg-white text-black border-white"
                : "bg-slate-800 text-slate-400 border-white/5 hover:border-white/20"
            }
                        `}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Feed Content */}
      <div className="space-y-3">
        {loading && !refreshing
          ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <RefreshCw className="animate-spin mr-2" size={20} />
              <span className="text-sm font-bold">Laddar aktiviteter...</span>
            </div>
          )
          : displayedEvents.length > 0
          ? (
            <>
              {displayedEvents.map((event) => (
                <FeedEventCard
                  key={event.id}
                  event={event}
                  userName="Du"
                  onUpdate={handleRefresh}
                />
              ))}

              {/* Expand/Collapse */}
              {events.length > 5 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="w-full py-3 flex items-center justify-center gap-2 text-slate-400 hover:text-white text-sm font-bold bg-slate-800/50 rounded-xl transition-colors"
                >
                  {expanded
                    ? (
                      <>
                        <ChevronUp size={16} />
                        Visa mindre
                      </>
                    )
                    : (
                      <>
                        <ChevronDown size={16} />
                        Visa {events.length - 5} fler aktiviteter
                      </>
                    )}
                </button>
              )}
            </>
          )
          : (
            <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-dashed border-white/10">
              <div className="text-3xl mb-3">📭</div>
              <p className="text-slate-400 text-sm">
                Inga aktiviteter att visa ännu.
              </p>
              <p className="text-slate-500 text-xs mt-1">
                Logga träning, kost eller hälsodata för att se dem här.
              </p>
            </div>
          )}
      </div>
    </section>
  );
}
