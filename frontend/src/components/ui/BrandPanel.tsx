import { memo } from 'react';
import { motion } from 'framer-motion';
import { FileText, Kanban, FlowArrow, Sparkle } from '@phosphor-icons/react';

const PILLARS = [
  { icon: FileText, title: 'Документация', desc: 'Структурные страницы и пространства знаний' },
  { icon: Kanban, title: 'Доски задач', desc: 'Канбан в духе Kaiten с богатыми карточками' },
  { icon: FlowArrow, title: 'Workflow', desc: 'Сквозные процессы и автоматизации' },
];

function BrandPanelBase() {
  return (
    <div className="relative hidden overflow-hidden bg-zinc-950 lg:block">
      {/* Grid texture — fixed, non-repainting */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      {/* Single soft accent wash — no neon glow */}
      <div className="pointer-events-none absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-accent/20 blur-3xl" />

      <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
        <div className="inline-flex items-center gap-2 text-sm text-zinc-400">
          <Sparkle size={16} weight="fill" className="text-accent" />
          Self-hosted — данные не покидают ваш периметр
        </div>

        <div>
          <h2 className="max-w-[15ch] text-4xl font-semibold leading-[1.05] tracking-tight text-white xl:text-[3.25rem]">
            Одна цифровая среда для всей компании
          </h2>

          <div className="mt-10 flex flex-col gap-3">
            {PILLARS.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12 * i + 0.1, type: 'spring', stiffness: 120, damping: 18 }}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-inset-hair backdrop-blur-sm"
                >
                  <motion.span
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut' }}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent"
                  >
                    <Icon size={22} weight="duotone" />
                  </motion.span>
                  <div>
                    <div className="text-[0.95rem] font-medium text-white">{p.title}</div>
                    <div className="text-sm text-zinc-400">{p.desc}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="text-sm text-zinc-500">© 2026 AI Portal</div>
      </div>
    </div>
  );
}

export const BrandPanel = memo(BrandPanelBase);
