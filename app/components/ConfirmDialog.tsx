'use client';

import { Button } from '@/components/ui/button';
import { useModalA11y } from '@/app/lib/useModalA11y';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const containerRef = useModalA11y(isOpen, onCancel);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        ref={containerRef}
        className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-sm p-6 space-y-5"
      >
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="text-sm text-gray-400">{message}</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="flex-1 rounded-xl text-gray-400 hover:bg-white/5 h-10"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className={`flex-1 rounded-xl h-10 font-bold ${
              destructive
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-accent hover:bg-accent/90'
            }`}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
