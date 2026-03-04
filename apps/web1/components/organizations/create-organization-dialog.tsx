"use client";

import { useState } from "react";
import { useOrganization } from "@/hooks/use-organization";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateOrganizationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateOrganizationDialog({
    open,
    onOpenChange,
}: CreateOrganizationDialogProps) {
    const { createOrganization } = useOrganization();
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateSlug = (value: string) => {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name) {
            setError("Organization name is required");
            return;
        }

        const slug = generateSlug(name);
        if (!slug) {
            setError("Please provide a valid organization name");
            return;
        }

        setIsLoading(true);
        try {
            await createOrganization({ name, slug });
            setName("");
            onOpenChange(false);
        } catch (err: any) {
            setError(err.message || "Failed to create organization");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Organization</DialogTitle>
                    <DialogDescription>
                        Create a new organization to collaborate with your team.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Organization Name</Label>
                            <Input
                                id="name"
                                placeholder="My Company"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        {error && (
                            <p className="text-sm text-red-600">{error}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading || !name}>
                            {isLoading ? "Creating..." : "Create Organization"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
