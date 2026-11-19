import BaoLoginCard from "@/components/bao/BaoLoginCard";
import { Skeleton } from "@/components/Skeleton";

export default function BaoLoginLoading() {
  return (
    <BaoLoginCard>
      <div role="status" className="space-y-5">
        <span className="sr-only">Loading sign-in form</span>
        <div><Skeleton className="mb-2 h-4 w-24" /><Skeleton className="h-12" /></div>
        <div><Skeleton className="mb-2 h-4 w-20" /><Skeleton className="h-12" /></div>
        <Skeleton className="h-12" />
      </div>
    </BaoLoginCard>
  );
}
