interface ProgressBarsProps {
  total: number;
  current: number;
  progress: number; // 0-100 for current item
  className?: string;
}

export function ProgressBars({ total, current, progress, className = '' }: ProgressBarsProps) {
  return (
    <div className={`flex gap-1 ${className}`}>
      {Array.from({ length: total }).map((_, idx) => (
        <div key={idx} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-white"
            style={{
              width: idx < current ? '100%' : idx === current ? `${progress}%` : '0%',
              transition: idx === current ? 'none' : 'width 0.3s ease-out',
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default ProgressBars;
