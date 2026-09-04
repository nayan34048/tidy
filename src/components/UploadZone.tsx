import { useRef, useState } from 'react';
import { Button } from './ui';

interface UploadZoneProps {
  onFile: (file: File) => void;
  onSample: () => void;
}

const ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,.json';

export function UploadZone({ onFile, onSample }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
        dragging ? 'border-moss-500 bg-moss-50 dark:bg-moss-900/20' : 'border-ink-300 bg-white dark:border-ink-700 dark:bg-ink-900'
      }`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-moss-100 text-2xl dark:bg-moss-900/40">📄</div>
      <div>
        <p className="font-display text-xl text-ink-800 dark:text-ink-100">Drop your dataset here</p>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">CSV, TSV, TXT, XLSX, XLS, or JSON</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary" onClick={() => inputRef.current?.click()}>
          Browse files
        </Button>
        <Button variant="secondary" onClick={onSample}>
          Load sample dataset
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
