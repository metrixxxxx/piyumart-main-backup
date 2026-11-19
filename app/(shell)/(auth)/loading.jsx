import { Skeleton } from "@/components/Skeleton";

export default function AuthLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-sm flex flex-col gap-4 p-8 bg-white rounded-2xl border border-gray-100 shadow">
        <Skeleton className="h-6 w-1/2 mx-auto" />
        <Skeleton className="h-3 w-3/4 mx-auto" />
        <Skeleton className="h-10 rounded-lg mt-4" />
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
      </div>
    </div>
  );
}