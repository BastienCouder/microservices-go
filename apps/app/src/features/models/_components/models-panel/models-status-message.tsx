type ModelsStatusMessageProps = {
  error: string | null;
  message: string | null;
};

export function ModelsStatusMessage({ error, message }: ModelsStatusMessageProps) {
  if (!error && !message) return null;

  return (
    <div className="border-b px-4 py-3 md:px-6">
      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-foreground">
          {message}
        </div>
      )}
    </div>
  );
}
