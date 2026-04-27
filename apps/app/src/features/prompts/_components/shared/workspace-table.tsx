import { Fragment, ReactNode } from "react";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type WorkspaceTableColumn = {
  id: string;
  label: ReactNode;
  className?: string;
};

type WorkspaceTableProps<T> = {
  columns: WorkspaceTableColumn[];
  rows: T[];
  getRowKey: (row: T) => string;
  renderRow: (row: T) => ReactNode;
  emptyLabel?: string;
  tableClassName?: string;
};

export function WorkspaceTable<T>({
  columns,
  rows,
  getRowKey,
  renderRow,
  emptyLabel = "No data found.",
  tableClassName,
}: WorkspaceTableProps<T>) {
  return (
    <Table className={tableClassName}>
      <TableHeader className="sticky top-0 z-10 bg-background">
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.id}
              className={cn("h-12 px-3 text-sm font-semibold text-muted-foreground", column.className)}
            >
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className="[&_td]:px-3 [&_td]:py-3">
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="py-4">
              <EmptyStateCard label={emptyLabel} className="h-20" />
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => <Fragment key={getRowKey(row)}>{renderRow(row)}</Fragment>)
        )}
      </TableBody>
    </Table>
  );
}
