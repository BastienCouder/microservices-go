import { useEffect, useState } from "react";

type ScoreGaugeProps = {
  score: number;
};

export function ScoreGauge({ score }: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const started = performance.now();
    const duration = 700;
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayScore(Math.round(score * eased));
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [score]);

  const radius = 72;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - displayScore / 100);

  return (
    <div className="relative mx-auto h-[120px] w-[190px]" aria-label={`Score ${score} out of 100`}>
      <svg viewBox="0 0 190 110" className="h-full w-full overflow-visible">
        <path
          d="M 23 91 A 72 72 0 0 1 167 91"
          fill="none"
          stroke="#eadfd3"
          strokeWidth="16"
          strokeLinecap="round"
          pathLength={circumference}
        />
        <path
          d="M 23 91 A 72 72 0 0 1 167 91"
          fill="none"
          stroke="#f26a21"
          strokeWidth="16"
          strokeLinecap="round"
          pathLength={circumference}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-150"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="text-4xl font-extrabold leading-none text-[#3a2418]">
          {displayScore}
        </div>
        <div className="mt-1 text-sm font-bold text-[#866d5d]">/100</div>
      </div>
    </div>
  );
}
