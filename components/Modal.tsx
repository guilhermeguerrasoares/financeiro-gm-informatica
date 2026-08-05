"use client";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center p-6 overflow-auto z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[var(--surface)] border-t-4 border-[var(--accent-blue)] rounded-lg w-full max-w-lg">
        <div className="p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
