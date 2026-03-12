"use client";

import { Fragment, ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
            <TableHead key={column.id} className={column.className}>
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
              {emptyLabel}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => <Fragment key={getRowKey(row)}>{renderRow(row)}</Fragment>)
        )}
      </TableBody>
    </Table>
  );
}
