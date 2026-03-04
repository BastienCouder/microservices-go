"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/server-api";
import { apiRoutes } from "@/lib/api-config";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Invoice {
    id: string;
    number: string;
    amount_paid: number;
    currency: string;
    created: number;
    status: string;
    pdf_url: string;
    hosted_url: string;
}

export default function InvoiceList() {
    const { data: invoices, isLoading, error } = useQuery({
        queryKey: ["invoices"],
        queryFn: async () => {
            const res = await apiFetch<Invoice[]>(apiRoutes.billing.invoices(), {
                method: "POST",
            });
            return res || [];
        },
    });

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: currency.toUpperCase(),
        }).format(amount / 100);
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Historique des factures</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Historique des factures</CardTitle>
                    <CardDescription>Impossible de charger vos factures pour le moment.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (!invoices || invoices.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Historique des factures</CardTitle>
                    <CardDescription>Aucune facture disponible.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Historique des factures</CardTitle>
                <CardDescription>
                    Consultez et téléchargez vos factures passées.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Montant</TableHead>
                            <TableHead>Numéro</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                                <TableCell>
                                    {format(new Date(invoice.created * 1000), "d MMMM yyyy", { locale: fr })}
                                </TableCell>
                                <TableCell className="font-medium">
                                    {formatCurrency(invoice.amount_paid, invoice.currency)}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {invoice.number}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" asChild>
                                        <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                                            <Download className="mr-2 h-4 w-4" />
                                            PDF
                                        </a>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
