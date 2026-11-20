const categoryPaths = new Map([
  ["All", "M4 8h16l1 13H3L4 8Zm4 1V7a4 4 0 0 1 8 0v2"],
  ["Beauty", "M7 14h10v7H7z M9 14V7l6-4v11 M9 9l6-4"],
  ["Books", "M12 6C9 4 6 3.5 2 4v15c4-.5 7 0 10 2 3-2 6-2.5 10-2V4c-4-.5-7 0-10 2Zm0 0v15"],
  ["Clothing", "m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z"],
  ["Electronics", "M4 5h16v12H4z M4 17l-2 3h20l-2-3"],
  ["Food & Drinks", "M3 8h14v6a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V8Zm14 1h2a3 3 0 0 1 0 6h-2 M7 3v2m5-2v2"],
  ["Home & Living", "m2 11 10-8 10 8 M5 9v12h5v-7h4v7h5V9"],
  ["Sports", "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20M12 2v20M5 5a10 10 0 0 1 0 14M19 5a10 10 0 0 0 0 14"],
  ["Toys", "m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10 9-5m-9 5L3 7m9 5v10"],
]);

const tagPath = "M3 3h9l10 10-9 9L3 12V3Zm5 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z";

export default function CategoryIcon({ name, className }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={categoryPaths.get(name) ?? tagPath} />
    </svg>
  );
}
