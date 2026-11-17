"use client";

export default function PaymentMethodPicker({ value, onChange, onlineEnabled, disabled = false }) {
  const methods = [
    { value: "cod", label: "Cash on Pick-up", description: "Pay the seller when you collect your order." },
    {
      value: "paymongo", label: "Pay online with PayMongo",
      description: onlineEnabled
        ? "Choose from the available payment methods on the secure PayMongo checkout page."
        : "Online payment is currently unavailable. Choose cash on pick-up to continue.",
      unavailable: !onlineEnabled,
    },
  ];

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <legend className="sr-only">Choose a payment method</legend>
      {methods.map((method) => {
        const selected = value === method.value;
        return (
          <label key={method.value} className={`flex items-center gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-[#1a2a6c]/30 dark:focus-within:ring-[#c9a028]/40 ${
            selected
              ? "border-[#1a2a6c] bg-[#f0f4ff] dark:border-[#c9a028] dark:bg-[#c9a028]/10"
              : "border-[#c5cfe8] bg-white hover:border-[#1a2a6c]/50 dark:border-white/10 dark:bg-transparent dark:hover:border-[#c9a028]/50"
          } ${method.unavailable || disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
            <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selected
              ? "bg-[#1a2a6c] text-white dark:bg-[#c9a028] dark:text-[#0a0e1f]"
              : "bg-[#1a2a6c]/5 text-[#1a2a6c] dark:bg-white/5 dark:text-[#c9a028]"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                {method.value === "cod" ? <>
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="12" cy="12" r="3" /><path d="M6 9h1m10 6h1" />
                </> : <>
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 10h18M7 15h4" />
                </>}
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-[#0e1a3d] dark:text-[#e8edf8]">{method.label}</span>
                {method.value === "paymongo" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">Test mode</span>}
              </span>
              <span id={`payment-${method.value}-description`} className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{method.description}</span>
            </span>
            <input type="radio" name="paymentMethod" value={method.value} checked={selected}
              disabled={method.unavailable} onChange={() => onChange(method.value)}
              aria-describedby={`payment-${method.value}-description`}
              className="h-4 w-4 shrink-0 accent-[#1a2a6c] dark:accent-[#c9a028]" />
          </label>
        );
      })}
    </fieldset>
  );
}
