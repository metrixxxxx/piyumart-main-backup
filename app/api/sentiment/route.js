import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hf } from "@/lib/huggingface";

function ratingInsight(averageRating, totalReviews = 0) {
  const rating = Number(averageRating || 0);
  const count = Number(totalReviews || 0);

  if (!count || !rating) {
    return {
      label: "NO_REVIEWS",
      tone: "neutral",
      score: 0,
      summary: "No rating-based review insight yet.",
    };
  }

  if (rating >= 4.5) {
    return {
      label: "VERY_POSITIVE",
      tone: "positive",
      score: Math.min(0.99, rating / 5),
      summary: "Buyers are rating this product very positively.",
    };
  }

  if (rating >= 3.8) {
    return {
      label: "POSITIVE",
      tone: "positive",
      score: Math.min(0.9, rating / 5),
      summary: "Buyer ratings are mostly positive.",
    };
  }

  if (rating >= 2.8) {
    return {
      label: "MIXED",
      tone: "mixed",
      score: rating / 5,
      summary: "Buyer ratings are mixed. Check the written reviews before buying.",
    };
  }

  return {
    label: "NEGATIVE",
    tone: "negative",
    score: Math.max(0.1, 1 - rating / 5),
    summary: "Buyer ratings are low for this product.",
  };
}

async function getProductReviewData(productId) {
  const [productRows] = await db.query(
    `SELECT 
      COALESCE(average_rating, 0) as average_rating,
      COALESCE(total_ratings, 0) as total_ratings
     FROM products
     WHERE id = $1`,
    [productId]
  );

  if (productRows.length === 0) return null;

  let comments = [];
  try {
    const [reviewRows] = await db.query(
      `SELECT comment
       FROM product_reviews
       WHERE product_id = $1 AND comment IS NOT NULL AND LENGTH(TRIM(comment)) > 0
       ORDER BY created_at DESC
       LIMIT 8`,
      [productId]
    );
    comments = reviewRows.map((row) => row.comment);
  } catch (err) {
    comments = [];
  }

  return {
    averageRating: Number(productRows[0].average_rating || 0),
    totalReviews: Number(productRows[0].total_ratings || 0),
    comments,
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, productId, rating, totalReviews } = body;

    let reviewData = null;
    if (productId) {
      reviewData = await getProductReviewData(productId);
      if (!reviewData) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
    }

    const averageRating = reviewData?.averageRating ?? Number(rating || 0);
    const reviewCount = reviewData?.totalReviews ?? Number(totalReviews || 0);
    const base = ratingInsight(averageRating, reviewCount);
    const comments = reviewData?.comments || [];
    const textToAnalyze = comments.length > 0 ? comments.join(". ") : text;

    let modelResult = null;
    if (textToAnalyze && typeof textToAnalyze === "string") {
      try {
        const result = await hf.textClassification({
          model: "distilbert-base-uncased-finetuned-sst-2-english",
          inputs: textToAnalyze.slice(0, 1500),
        });
        modelResult = Array.isArray(result) ? result[0] : result;
      } catch (err) {
        console.warn("[Sentiment model unavailable]", err.message);
      }
    }

    return NextResponse.json({
      analysis: {
        ...base,
        averageRating,
        totalReviews: reviewCount,
        source: productId ? "product_ratings_and_reviews" : "provided_rating_or_text",
        modelLabel: modelResult?.label || null,
        modelScore: modelResult?.score || null,
        summary:
          reviewCount > 0
            ? `${base.summary} Average rating: ${averageRating.toFixed(1)} from ${reviewCount} review${reviewCount === 1 ? "" : "s"}.`
            : base.summary,
      },
      result: modelResult ? [modelResult] : [],
    });
  } catch (error) {
    console.error("[Sentiment Error]", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
