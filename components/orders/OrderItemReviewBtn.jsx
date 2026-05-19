"use client";
import { useState } from "react";
import FeedbackModal from "@/components/ui/FeedbackModal";
import LoadingModal from "@/components/ui/LoadingModal";

export default function OrderItemReviewBtn({ productId, productName, onSuccess }) {
  const [showModal, setShowModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (rating === 0) {
      setFeedback({
        type: "error",
        title: "Select a rating",
        description: "Choose 1 to 5 stars before submitting your review.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          title: "Review not submitted",
          description: data.error || "Failed to submit review",
        });
      } else {
        setComment("");
        setRating(0);
        setShowModal(false);
        setFeedback({
          type: "success",
          title: "Review submitted",
          description: "Your rating is now included in this product's review insight.",
        });
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error("Error submitting review:", err);
      setFeedback({
        type: "error",
        title: "Review not submitted",
        description: "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#ede9ff] dark:bg-[#c9a96e]/10 text-[#6d4aff] dark:text-[#c9a96e] hover:opacity-80 transition whitespace-nowrap"
      >
        ⭐ Review
      </button>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-[#12121a] rounded-2xl border border-[#e8e5f0] dark:border-white/[0.07] p-6 max-w-md w-full shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#1a1060] dark:text-[#f0ede8] mb-1">
              Review &quot;{productName}&quot;
            </h3>
            <p className="text-xs text-[#1a1060]/50 dark:text-[#f0ede8]/40 mb-4">
              Share your experience with this product
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* RATING */}
              <div>
                <p className="text-sm font-semibold text-[#1a1060]/70 dark:text-[#f0ede8]/60 mb-2">
                  Rating
                </p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRating(r)}
                      className={`text-3xl cursor-pointer transition-all ${
                        r <= rating
                          ? "text-[#FFB800] scale-110"
                          : "text-[#e5e7eb] dark:text-white/[0.1]"
                      } hover:scale-110`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
              </div>

              {/* COMMENT */}
              <div>
                <p className="text-sm font-semibold text-[#1a1060]/70 dark:text-[#f0ede8]/60 mb-2">
                  Comment (Optional)
                </p>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What did you think about this product?"
                  className="w-full p-2.5 text-sm border border-[#e5e7eb] dark:border-white/[0.1] rounded-xl bg-[#f9fafb] dark:bg-white/[0.04] text-[#1a1060] dark:text-[#f0ede8] placeholder-[#1a1060]/30 dark:placeholder-[#f0ede8]/20 focus:outline-none focus:ring-2 focus:ring-[#6d4aff] dark:focus:ring-[#c9a96e]"
                  rows="3"
                  maxLength="500"
                />
                <p className="text-xs text-[#1a1060]/40 dark:text-[#f0ede8]/30 mt-1">
                  {comment.length}/500
                </p>
              </div>

              {/* BUTTONS */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 px-3 rounded-xl border border-[#e5e7eb] dark:border-white/[0.1] text-[#1a1060] dark:text-[#f0ede8] font-semibold text-sm hover:bg-[#f9fafb] dark:hover:bg-white/[0.04] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || rating === 0}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#6d4aff] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                >
                  {submitting ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <LoadingModal
        open={submitting}
        title="Submitting review"
        description="Saving your rating and updating product insight."
      />
      <FeedbackModal
        open={Boolean(feedback)}
        type={feedback?.type}
        title={feedback?.title}
        description={feedback?.description}
        onClose={() => setFeedback(null)}
      />
    </>
  );
}
