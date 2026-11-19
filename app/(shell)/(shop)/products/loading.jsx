import { Skeleton } from "@/components/Skeleton";

export default function ProductsLoading() {
  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-8">
      <div className="flex gap-2 mb-6">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-gray-100">
            <Skeleton className="aspect-square w-full rounded-none sm:aspect-auto sm:h-48" />
            <div className="flex flex-col gap-1 p-1.5 sm:gap-2 sm:p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-5 w-1/3 mt-1" />
              <div className="mt-2 hidden gap-2 sm:flex">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-9 flex-1" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
