import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { TableVirtuoso } from "react-virtuoso";
import { Skeleton } from "@/components/ui/skeleton";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type AiResponsesTableColumn = {
  id: string;
  label: ReactNode;
  className?: string;
};

export const aiResponsesTableComponents = {
  Scroller: forwardRef<HTMLDivElement, ComponentProps<"div">>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("h-full overflow-auto [contain:strict]", className)} {...props} />
  )),
  Table: ({ className, ...props }: ComponentProps<"table">) => (
    <table className={cn("w-full min-w-[980px] caption-bottom text-sm", className)} {...props} />
  ),
  TableHead: forwardRef<HTMLTableSectionElement, ComponentProps<"thead">>(({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
  )),
  TableBody: forwardRef<HTMLTableSectionElement, ComponentProps<"tbody">>(({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0 [&_td]:px-3 [&_td]:py-3", className)} {...props} />
  )),
  TableRow: ({ className, ...props }: ComponentProps<"tr">) => (
    <tr className={cn("cursor-pointer border-b transition-colors hover:bg-muted/50", className)} {...props} />
  ),
};

export function AiResponsesTableLoadingRows({
  columns = 8,
  rows = 7,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-3 py-4">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-3 rounded-md border bg-background p-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn(
                "h-6 rounded-full",
                columnIndex === 2 ? "min-w-[180px]" : "",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function AiResponsesTable<T>({
  columns,
  rows,
  getRowId,
  renderRow,
  loading = false,
  loadingState,
  emptyState,
  defaultItemHeight = 82,
  minWidthClassName = "min-w-[980px]",
  onEndReached,
}: {
  columns: AiResponsesTableColumn[];
  rows: T[];
  getRowId: (row: T) => string;
  renderRow: (row: T) => ReactNode;
  loading?: boolean;
  loadingState?: ReactNode;
  emptyState: ReactNode;
  defaultItemHeight?: number;
  minWidthClassName?: string;
  onEndReached?: () => void;
}) {
  if (loading) {
    return loadingState ?? <AiResponsesTableLoadingRows columns={columns.length} />;
  }

  if (rows.length === 0) {
    return emptyState;
  }

  return (
    <TableVirtuoso
      style={{ height: "100%" }}
      data={rows}
      computeItemKey={(_, item) => getRowId(item)}
      defaultItemHeight={defaultItemHeight}
      endReached={onEndReached}
      increaseViewportBy={{ top: 96, bottom: 160 }}
      fixedHeaderContent={() => (
        <tr>
          {columns.map((column) => (
            <TableHead
              key={column.id}
              className={cn(
                "h-12 bg-background px-3 text-sm font-semibold text-muted-foreground",
                column.className,
              )}
            >
              {column.label}
            </TableHead>
          ))}
        </tr>
      )}
      itemContent={(_, item) => renderRow(item)}
      components={{
        ...aiResponsesTableComponents,
        Table: ({ className, ...props }: ComponentProps<"table">) => (
          <table
            className={cn(
              "w-full caption-bottom text-sm",
              minWidthClassName,
              className,
            )}
            {...props}
          />
        ),
      }}
    />
  );
}
