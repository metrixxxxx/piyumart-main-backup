import { NextResponse } from "next/server";
import { getBaoAccess } from "@/lib/bao-access";
import { BAO_COMMISSION_TIERS } from "@/lib/commission-policy";
import { readCommissionReport } from "@/lib/bao-commission-report";

const PAGE_SIZE = 50;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatManilaDate(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map(({ type, value }) => [type, value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getDefaultRange() {
  const to = formatManilaDate(new Date());
  const from = new Date(`${to}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: formatDate(from), to };
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && formatDate(date) === value;
}

export async function GET(req) {
  try {
    const access = await getBaoAccess();
    if (!access.session) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const defaultRange = getDefaultRange();
    const from = searchParams.get("from") || defaultRange.from;
    const to = searchParams.get("to") || defaultRange.to;
    const requestedPage = Number(searchParams.get("page") || 1);
    if (!isValidDate(from) || !isValidDate(to) || from > to) {
      return NextResponse.json({ error: "Select a valid date range." }, { status: 400 });
    }
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 10000) {
      return NextResponse.json({ error: "Invalid commission history page." }, { status: 400 });
    }

    const report = await readCommissionReport({ from, to, requestedPage, pageSize: PAGE_SIZE });
    return NextResponse.json(
      { commissionTiers: BAO_COMMISSION_TIERS, ...report },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("BAO commission report request failed:", error);
    return NextResponse.json(
      { error: "Unable to load commission records." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const access = await getBaoAccess();
    if (!access.session) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    return NextResponse.json(
      { error: "BAO commission now follows item price tiers. A flat commission rate can no longer be set." },
      { status: 409 }
    );
  } catch (error) {
    console.error("BAO commission rate update failed:", error);
    return NextResponse.json(
      { error: "Unable to save the commission rate." },
      { status: 500 }
    );
  }
}
