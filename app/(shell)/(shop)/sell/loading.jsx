import { Skeleton } from "@/components/Skeleton";

export default function SellLoading() {
  return (
    <main className="p-8 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl p-6 mb-8 flex items-center gap-4 border border-gray-100">
        <Skeleton className="w-14 h-14 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="ml-auto h-10 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-5 w-32 mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-gray-100">
            <Skeleton className="h-40 w-full rounded-none" />
            <div className="p-4 flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-3 w-1/2 mt-1" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}