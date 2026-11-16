export default function ListingLocation({ product, className = "" }) {
  return <div className={`space-y-1 text-xs leading-5 text-slate-600 dark:text-slate-300 ${className}`}>
    <p className="break-words"><span className="font-semibold">Department:</span> {product.department || "Not provided"}</p>
    <p className="break-words"><span className="font-semibold">Meetup:</span> {product.meetup_point || "Confirm with seller"}</p>
  </div>;
}
