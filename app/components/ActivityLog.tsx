import { motion, AnimatePresence } from 'framer-motion';

interface ActivityLogProps {
  logs: { type: 'success' | 'error'; message: string; timestamp: number }[];
  onClear: () => void;
}

export function ActivityLog({ logs, onClear }: ActivityLogProps) {
  return (
    <AnimatePresence>
      {logs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="p-4 bg-gray-900/50 rounded-2xl border border-gray-800 backdrop-blur-sm"
        >
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Activity Log
            </h4>
            <button
              onClick={onClear}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
            {logs.map((log, index) => (
              <div key={`${log.timestamp}-${index}`} className="text-sm flex items-start gap-3">
                <span className={log.type === 'success' ? 'text-green-500' : 'text-red-500'}>
                  {log.type === 'success' ? '✓' : '✕'}
                </span>
                <span className="text-gray-400">{log.message}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
