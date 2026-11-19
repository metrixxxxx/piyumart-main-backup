export default function ShopLoading() {
  return (
    <main className="p-8 max-w-7xl mx-auto">
      {/* Hero skeleton */}
      <div className="rounded-xl p-10 mb-10 bg-gray-100 animate-pulse h-32" />

      {/* Category pills skeleton */}
      <div className="flex gap-2 mb-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-gray-100 animate-pulse" />
        ))}
      </div>

      {/* Products grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-gray-100 animate-pulse">
            <div className="h-48 bg-gray-200" />
            <div className="p-4 flex flex-col gap-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
              <div className="h-5 bg-gray-200 rounded w-1/3 mt-1" />
              <div className="flex gap-2 mt-2">
                <div className="h-9 bg-gray-200 rounded-lg flex-1" />
                <div className="h-9 bg-gray-200 rounded-lg flex-1" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}