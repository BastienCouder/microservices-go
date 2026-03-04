import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default function Loading() {
    return (
        <main className="flex-1 p-8 max-w-6xl mx-auto space-y-8">
            <div>
                <Skeleton className="h-9 w-64 mb-2" />
                <Skeleton className="h-5 w-96" />
            </div>

            <div className="space-y-4">
                {/* Filters Skeleton */}
                <div className="flex gap-4">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-32" />
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                                <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                                <TableHead className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-32" /></div></TableCell>
                                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </main>
    );
}
