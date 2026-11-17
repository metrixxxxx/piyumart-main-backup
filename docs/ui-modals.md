# Confirmation and action feedback

The shared dialogs use PiyuMart's navy/gold styling, responsive layouts, light
and dark themes, focus management, and reduced-motion support.

- `ModalShell` uses a native modal dialog to keep background controls inactive.
  It restores page scrolling on close and handles the active dialog's Escape key.
- `ConfirmModal` waits for the actual confirmation promise, prevents repeated
  submissions, and stays visible even when its owner clears the confirmation
  state before the request finishes. Failures remain visible and actionable.
- `LoadingModal` shows an indeterminate spinner and progress animation tied to
  the actual request. Busy dialogs retain keyboard focus and block dismissal.
- `FeedbackModal` presents success, error, and informational outcomes.
- `ActionFeedback` connects an existing form's pending/error/success states to
  the dialogs. The same error can be displayed again after a retry. Background
  catalogue and Realtime refreshes stay nonblocking.

Integrated flows include shopper/staff sign-in and sign-out, registration,
password/profile forms, cart updates, checkout, order receipt/cancellation,
listings, seller applications and moderation, reports, commissions, and wallet
actions. Browser alerts have been replaced by styled feedback. Destructive API
responses are checked before the UI removes records or displays success.

BAO withdrawal confirmations acknowledge the current user's request. The BAO
destination/cashout no-review policy and all financial API rules remain in place.

## Verification

The production build passed after the temporary verification route was removed.
An isolated headless Chrome session checked:

- Confirmation focus containment and Escape cancellation.
- Busy dialogs staying open, blocking Escape, and completing only once.
- Visible errors when a confirmation fails after its owner closes.
- The same error reopening correctly on retry without a stale loader.
- Mobile/dark layout, viewport bounds, exact centering, and scroll restoration.
- The actual login page's styled invalid-email feedback, without submitting
  credentials or creating any real orders, accounts, payments, or cashouts.

Local screenshots and the check report are under `backups/modal-preview/` and
are excluded from Git. The preview server and isolated browser were stopped.

The shared modal components pass ESLint. Existing `set-state-in-effect` errors
remain in the product catalogue, seller-applications list, and navbar hero-scroll
effects; these predate the modal changes. The existing middleware deprecation
warning is also unrelated to this update.
