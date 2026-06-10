"use client";

type StepProgressProps = {
    step: number;
    total: number;
};

export function StepProgress({ step, total }: StepProgressProps) {
    const safeStep = Math.min(Math.max(step, 1), total);

    return (
        <div className="rounded-full bg-zinc-200/90 p-1.5">
            <div className="flex items-center gap-2">
                {Array.from({ length: total }).map((_, index) => {
                    const current = index + 1 === safeStep;
                    const passed = index + 1 < safeStep;

                    return (
                        <div
                            key={index}
                            className={[
                                "h-2.5 rounded-full transition-all duration-350 ease-out",
                                current ? "w-3 bg-primary" : passed ? "w-8 bg-primary/75" : "w-6 bg-white/80",
                            ].join(" ")}
                        />
                    );
                })}
            </div>
        </div>
    );
}
