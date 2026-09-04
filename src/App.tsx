import { useEffect, useState } from 'react';
import { useDatasetStore } from './hooks/useDatasetStore';
import { Dashboard } from './pages/Dashboard';
import { Clean } from './pages/Clean';
import { Transform } from './pages/Transform';
import { Merge } from './pages/Merge';
import { Validate } from './pages/Validate';
import { Export } from './pages/Export';
import { Badge, Button, Dialog, EmptyState, Tabs } from './components/ui';
import { formatNumber } from './utils/format';

type Tab = 'dashboard' | 'clean' | 'merge' | 'transform' | 'validate' | 'export';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clean', label: 'Clean' },
  { id: 'merge', label: 'Merge' },
  { id: 'transform', label: 'Transform' },
  { id: 'validate', label: 'Validate' },
  { id: 'export', label: 'Export' },
];

export default function App() {
  const store = useDatasetStore();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [helpOpen, setHelpOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const { current, original, session } = store;

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur dark:border-ink-800 dark:bg-ink-950/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-moss-700 font-display text-sm text-white">T</span>
              <h1 className="font-display text-xl text-ink-900 dark:text-ink-50">Tidy</h1>
              <span className="hidden text-xs text-ink-400 sm:inline">Clean your data. Trust your analysis.</span>
            </div>

            <div className="flex items-center gap-2">
              {current && (
                <>
                  <Badge>{formatNumber(current.rows.length)} rows</Badge>
                  <Badge>{formatNumber(current.columns.length)} cols</Badge>
                  <div className="hidden gap-1 sm:flex">
                    <Button size="sm" onClick={store.undo} disabled={!store.canUndo}>
                      Undo
                    </Button>
                    <Button size="sm" onClick={store.redo} disabled={!store.canRedo}>
                      Redo
                    </Button>
                    <Button size="sm" onClick={store.reset} disabled={!store.canUndo}>
                      Reset
                    </Button>
                  </div>
                </>
              )}
              <Button size="sm" variant="ghost" aria-label="Help and settings" onClick={() => setHelpOpen(true)}>
                Help
              </Button>
            </div>
          </div>

          {current && (
            <div className="flex items-center justify-between gap-3">
              <Tabs tabs={TABS} value={tab} onChange={setTab} />
              <span className="hidden truncate text-xs text-ink-400 md:inline">{current.meta.name}</span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {!current || !original ? (
          tab !== 'dashboard' ? (
            <EmptyState
              title="No dataset loaded"
              description="Upload a CSV, Excel, JSON, or TSV file to get started."
              action={<Button variant="primary" onClick={() => setTab('dashboard')}>Go to Dashboard</Button>}
            />
          ) : (
            <Dashboard dataset={null} onLoad={store.load} />
          )
        ) : (
          <>
            {tab === 'dashboard' && <Dashboard dataset={current} onLoad={store.load} />}
            {tab === 'clean' && <Clean dataset={current} onApply={store.apply} />}
            {tab === 'transform' && <Transform dataset={current} onApply={store.apply} />}
            {tab === 'merge' && <Merge dataset={current} onApply={store.apply} />}
            {tab === 'validate' && (
              <Validate
                dataset={current}
                history={session!.history}
                canUndo={store.canUndo}
                canRedo={store.canRedo}
                onUndo={store.undo}
                onRedo={store.redo}
                onReset={store.reset}
                onClearHistory={store.clearHistory}
              />
            )}
            {tab === 'export' && <Export dataset={current} original={original} history={session!.history} />}
          </>
        )}
      </main>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title="About Tidy">
        <div className="flex flex-col gap-3 text-sm text-ink-600 dark:text-ink-300">
          <p>
            Tidy cleans, transforms, merges, and validates datasets entirely in your browser. Nothing you upload is
            sent to a server — files are parsed and processed on your device using your browser's own memory.
          </p>
          <p>Workflow: Upload → Inspect → Clean → Transform → Merge → Validate → Export.</p>
          <div className="flex items-center justify-between border-t border-ink-100 pt-3 dark:border-ink-800">
            <span>Dark mode</span>
            <Button size="sm" onClick={() => setDark((d) => !d)}>
              {dark ? 'Switch to light' : 'Switch to dark'}
            </Button>
          </div>
          {current && (
            <div className="flex items-center justify-between border-t border-ink-100 pt-3 dark:border-ink-800">
              <span>Start over with a new file</span>
              <Button size="sm" variant="destructive" onClick={() => { store.close(); setHelpOpen(false); setTab('dashboard'); }}>
                Close dataset
              </Button>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
