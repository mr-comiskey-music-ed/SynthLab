import React, { useMemo, useState } from 'react';
import { X, Link2, Copy, Check } from 'lucide-react';
import { ALL_TASKS, TASK_CATEGORIES } from '../utils/taskCatalog';
import { copyText } from '../utils/copyText';

interface AssignmentLinkBuilderProps {
  onClose: () => void;
}

/**
 * Teacher tool: pick tasks, get a link to post in Google Classroom.
 * Students who open the link are graded only on the picked tasks.
 * The link just carries the task list; nothing is stored anywhere.
 */
export const AssignmentLinkBuilder: React.FC<AssignmentLinkBuilderProps> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<'idle' | 'copied' | 'manual'>('idle');

  const cleanName = name.trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  const ordered = ALL_TASKS.filter((t) => picked.has(t.id)).map((t) => t.id);
  const link = useMemo(() => {
    if (!ordered.length) return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    const q = new URLSearchParams();
    if (cleanName) q.set('assignment', cleanName);
    q.set('tasks', ordered.join(','));
    return `${base}?${q.toString().replace(/%2C/g, ',')}`;
  }, [ordered.join(','), cleanName]);

  const toggle = (id: string) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
    setCopied('idle');
  };
  const setCategory = (cat: string, on: boolean) => {
    const next = new Set(picked);
    ALL_TASKS.filter((t) => t.category === cat).forEach((t) => (on ? next.add(t.id) : next.delete(t.id)));
    setPicked(next);
    setCopied('idle');
  };

  // Separate, fixed links to the optional synth guides (not graded, no tasks).
  const guideLink = (id: string) => `${window.location.origin}${window.location.pathname}?guide=${id}`;
  const [guideCopied, setGuideCopied] = useState<string | null>(null);
  const handleCopyGuide = async (id: string) => {
    if (await copyText(guideLink(id))) {
      setGuideCopied(id);
      setTimeout(() => setGuideCopied((c) => (c === id ? null : c)), 2500);
    }
  };

  const handleCopy = async () => {
    if (await copyText(link)) {
      setCopied('copied');
      setTimeout(() => setCopied('idle'), 2500);
    } else {
      setCopied('manual');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-950 border-2 border-amber-500/40 p-5 shadow-2xl text-slate-100 font-mono flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Make an Assignment Link</h3>
              <p className="text-[11px] text-slate-400">
                Pick the tasks to grade. Students who open the link are graded only on these.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1 min-h-0 text-xs">
          <label className="block">
            <span className="block text-slate-300 font-semibold mb-1.5">Assignment name (shows in the gradebook):</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Filters-Week-6"
              className="w-full sm:w-80 px-3 py-2 rounded-lg bg-black/50 text-amber-300 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </label>

          {TASK_CATEGORIES.map((cat) => {
            const tasks = ALL_TASKS.filter((t) => t.category === cat);
            const n = tasks.filter((t) => picked.has(t.id)).length;
            return (
              <div key={cat} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-amber-300">
                    {cat} <span className="text-slate-500 font-normal">({n}/{tasks.length})</span>
                  </span>
                  <span className="flex gap-1.5">
                    <button type="button" onClick={() => setCategory(cat, true)} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">
                      All
                    </button>
                    <button type="button" onClick={() => setCategory(cat, false)} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">
                      None
                    </button>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {tasks.map((t) => (
                    <label key={t.id} className="flex items-start gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer text-[11px] text-slate-200">
                      <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} className="mt-0.5 accent-amber-500" />
                      <span>{t.shortTitle}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          {[
            {
              id: 'soundtrap',
              title: 'Soundtrap Synth Guide link (optional, not graded)',
              blurb: 'Opens straight to the guide that maps SynthLab to Soundtrap’s synth. Post it when your class starts making sounds in Soundtrap.',
            },
            {
              id: 'retro',
              title: 'Retro Synth Guide link (optional, not graded)',
              blurb: 'Opens straight to the guide that maps SynthLab to Logic Pro’s Retro Synth. Post it when your class starts making sounds in Logic.',
            },
          ].map((g) => (
            <div key={g.id} className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-1.5">
              <span className="block font-bold text-sky-300">{g.title}</span>
              <p className="text-[11px] text-slate-400">{g.blurb} Students who finish steps see them on their Grade Report.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  readOnly
                  value={guideLink(g.id)}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 px-2 py-1 rounded bg-black/70 text-sky-200 text-[11px] border border-sky-500/30"
                />
                <button
                  type="button"
                  onClick={() => handleCopyGuide(g.id)}
                  className="px-3 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-bold flex items-center justify-center gap-1"
                >
                  {guideCopied === g.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {guideCopied === g.id ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 mt-4 border-t border-white/10 space-y-2 text-xs">
          {link ? (
            <>
              <textarea
                readOnly
                rows={2}
                value={link}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 rounded-lg bg-black/90 text-emerald-400 text-[11px] border border-emerald-500/40 break-all resize-none"
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-slate-400">
                  {copied === 'manual'
                    ? 'Copying was blocked. Click the link above and press Ctrl+C.'
                    : `${ordered.length} task${ordered.length > 1 ? 's' : ''} · post this link in your Google Classroom assignment.`}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase flex items-center justify-center gap-1.5"
                >
                  {copied === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied === 'copied' ? 'Link Copied!' : 'Copy Link'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-slate-500">Pick at least one task to make a link.</p>
          )}
        </div>
      </div>
    </div>
  );
};
