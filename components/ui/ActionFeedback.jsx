"use client";

import { useState } from "react";
import FeedbackModal from "@/components/ui/FeedbackModal";
import LoadingModal from "@/components/ui/LoadingModal";

// Action states stay with their owning form. Background refreshes need no overlay.
export default function ActionFeedback({ pending = false, error = "", success = "", pendingTitle = "Saving your changes", pendingDescription = "Please wait while we finish your request.", errorTitle = "Unable to complete your request", successTitle = "Saved successfully", showLoading = true }) {
  const message = String(error || success || "");
  const type = error ? "error" : "success";
  const [snapshot, setSnapshot] = useState({ pending, message, type, version: 0 });
  const [dismissed, setDismissed] = useState(-1);
  if (snapshot.pending !== pending || snapshot.message !== message || snapshot.type !== type) {
    setSnapshot({ pending, message, type, version: snapshot.version + 1 });
  }
  return <>
    <LoadingModal open={Boolean(pending && showLoading)} title={pendingTitle} description={pendingDescription} />
    <FeedbackModal open={Boolean(!pending && message && dismissed !== snapshot.version)} type={type} title={error ? errorTitle : successTitle}
      description={message} onClose={() => setDismissed(snapshot.version)} />
  </>;
}
