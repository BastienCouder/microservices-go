import { Fragment, ReactNode } from "react";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
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
  loading?: boolean;
  loadingRowCount?: number;
  renderLoadingRow?: (index: number) => ReactNode;
  emptyLabel?: string;
  tableClassName?: string;
};

export function WorkspaceTable<T>({
  columns,
  rows,
  getRowKey,
  renderRow,
  loading = false,
  loadingRowCount = 6,
  renderLoadingRow,
  emptyLabel,
  tableClassName,
}: WorkspaceTableProps<T>) {
  const { t } = useScopedI18n("shared-ui");

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
        {loading && renderLoadingRow ? (
          Array.from({ length: loadingRowCount }).map((_, index) => (
            <Fragment key={index}>{renderLoadingRow(index)}</Fragment>
          ))
        ) : rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="py-4">
              <EmptyStateCard label={emptyLabel ?? t("noDataFound")} className="h-20" />
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => <Fragment key={getRowKey(row)}>{renderRow(row)}</Fragment>)
        )}
      </TableBody>
    </Table>
  );
}
