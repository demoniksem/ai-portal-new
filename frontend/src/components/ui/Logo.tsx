import { SquaresFour } from '@phosphor-icons/react';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white shadow-diffusion">
        <SquaresFour size={20} weight="fill" />
      </span>
      {!compact && (
        <span className="text-[1.05rem] font-semibold tracking-tight text-fg">AI Portal</span>
      )}
    </span>
  );
}
