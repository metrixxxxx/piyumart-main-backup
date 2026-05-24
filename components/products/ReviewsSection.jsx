"use client";
import { useCallback, useEffect, useState } from "react";

function StarRow({ rating, size = "w-7 h-7" }) {
  return (
    <div className="flex justify-center gap-1">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          width="28"
          height="28"
          viewBox="0 0 20 20"
          fill={i < Math.round(rating || 0) ? "#FFB800" : "#d1d5db"}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewStars({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill={i < rating ? "#FFB800" : "#d1d5db"}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewsSection({ productId, product }) {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ total_reviews: 0, average_rating: null });
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState("recent");
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/products/${productId}/reviews?sortBy=${sortBy}`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      const data = await res.json();
      const reviewsArray = Array.isArray(data.reviews) ? data.reviews : [];
      const statsData = data.stats || { total_reviews: 0, average_rating: null };
      setReviews(reviewsArray);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to fetch reviews:", err);
      setReviews([]);
      setStats({ total_reviews: 0, average_rating: null });
    } finally {
      setLoading(false);
    }
  }, [productId, sortBy]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    let cancelled = false;

    async function loadInsight() {
      setInsightLoading(true);
      try {
        const res = await fetch("/api/sentiment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId,
            rating: stats?.average_rating,
            totalReviews: stats?.total_reviews,
            text: product?.description,
          }),
        });
        const data = await res.json();
        if (!cancelled) setInsight(data.analysis || null);
      } catch (err) {
        if (!cancelled) setInsight(null);
      } finally {
        if (!cancelled) setInsightLoading(false);
      }
    }

    if (productId) loadInsight();
    return () => { cancelled = true; };
  }, [productId, product?.description, stats?.average_rating, stats?.total_reviews]);

  return (
    <div className="mt-14">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-[#1a1060] dark:text-[#f0ede8] m-0">
          Customer Reviews
        </h2>
        <div className="flex-1 h-px bg-[#e5e7eb] dark:bg-white/[0.07]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* STATS CARD */}
        <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.07)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
          <div className="text-center">
            <div className="text-5xl font-bold text-[#6d4aff] dark:text-[#c9a96e] mb-2">
              {stats?.average_rating ? Number(stats.average_rating).toFixed(1) : "—"}
            </div>
            <div className="mb-2">
              <StarRow rating={stats?.average_rating || 0} />
            </div>
            <p className="text-sm text-[#1a1060]/60 dark:text-[#f0ede8]/50">
              {stats?.total_reviews || 0} review{stats?.total_reviews !== 1 ? "s" : ""}
            </p>
          </div>

          {product?.sold_count > 0 && (
            <>
              <hr className="my-4 border-[#e5e7eb] dark:border-white/[0.07]" />
              <div className="text-center">
                <p className="text-sm text-[#1a1060]/60 dark:text-[#f0ede8]/50 mb-1">Items Sold</p>
                <p className="text-3xl font-bold text-[#6d4aff] dark:text-[#c9a96e]">{product.sold_count}</p>
              </div>
            </>
          )}

          {stats?.total_reviews > 0 && (
            <>
              <hr className="my-4 border-[#e5e7eb] dark:border-white/[0.07]" />
              <div className="rounded-xl bg-[#f0f4ff] p-4 text-left dark:bg-white/[0.04]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#1a2a6c] dark:text-[#c9a028]">
                  Rating Insight
                </p>
                <p className="mt-2 text-sm font-semibold text-[#1a1060] dark:text-[#f0ede8]">
                  {insightLoading
                    ? "Analyzing product ratings..."
                    : insight?.label === "NO_REVIEWS"
                    ? "No review signal yet"
                    : insight?.label?.replaceAll("_", " ") || "No review signal yet"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#1a1060]/55 dark:text-[#f0ede8]/45">
                  {insightLoading
                    ? "Please wait while ratings and comments are checked."
                    : insight?.summary || "Reviews and ratings will appear here once buyers submit them."}
                </p>
              </div>
            </>
          )}
        </div>

        {/* REVIEWS LIST */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.07)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#1a1060] dark:text-[#f0ede8] m-0">Reviews</h3>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#f9fafb] dark:bg-white/[0.04] border border-[#e5e7eb] dark:border-white/[0.1] text-[#1a1060] dark:text-[#f0ede8] cursor-pointer"
              >
                <option value="recent">Most Recent</option>
                <option value="highest_rated">Highest Rated</option>
                <option value="lowest_rated">Lowest Rated</option>
              </select>
            </div>

            {loading ? (
              <p className="text-sm text-[#1a1060]/40 dark:text-[#f0ede8]/30 text-center py-8">
                Loading reviews...
              </p>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-[#1a1060]/40 dark:text-[#f0ede8]/30 text-center py-8">
                No reviews yet.
              </p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="border-b border-[#e5e7eb] dark:border-white/[0.07] pb-4 last:border-b-0"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-[#1a1060] dark:text-[#f0ede8] text-sm">
                          {review.user_name}
                        </p>
                        <p className="text-xs text-[#1a1060]/40 dark:text-[#f0ede8]/30">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ReviewStars rating={review.rating} />
                    </div>
                    {review.comment && (
                      <p className="text-sm text-[#1a1060]/60 dark:text-[#f0ede8]/50">
                        {review.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}