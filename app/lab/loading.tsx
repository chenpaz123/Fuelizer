import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function LabLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-28" />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2 text-center">
            <Skeleton className="mx-auto h-5 w-52" />
            <Skeleton className="mx-auto h-4 w-64" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <Skeleton className="aspect-square w-full rounded-2xl" />
          </div>
          <Skeleton className="h-14 w-full rounded-2xl" />
        </CardContent>
      </Card>
    </div>
  );
}
