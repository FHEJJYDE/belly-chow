import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export const VendorCardSkeleton = () => (
  <Card className="overflow-hidden">
    <Skeleton className="h-32 w-full" />
    <CardContent className="p-4 space-y-2">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-3 mt-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
    </CardContent>
  </Card>
);

export const OrderCardSkeleton = () => (
  <Card>
    <CardContent className="p-4 space-y-3">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <Skeleton className="h-8 w-full" />
    </CardContent>
  </Card>
);

export const MenuItemSkeleton = () => (
  <Card>
    <CardContent className="flex items-center justify-between p-4">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-9 w-16 ml-4" />
    </CardContent>
  </Card>
);

export const DashboardStatSkeleton = () => (
  <Card>
    <CardContent className="flex items-center gap-3 p-4">
      <Skeleton className="h-8 w-8 rounded" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-12" />
      </div>
    </CardContent>
  </Card>
);

export const TableRowSkeleton = ({ cols = 5 }: { cols?: number }) => (
  <div className="flex items-center gap-4 p-4 border-b">
    {Array.from({ length: cols }).map((_, i) => (
      <Skeleton key={i} className="h-4 flex-1" />
    ))}
  </div>
);
