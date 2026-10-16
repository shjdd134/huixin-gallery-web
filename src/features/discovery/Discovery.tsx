import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Modal } from '../../components/Modal';
import { storageError, type Collection } from '../../data/db';
import { findActivity, findTheme, modeLabels, themes } from './catalog';
import { candidates, evidenceCurrent, sameEvidence, type Decision, type Evidence, type Trial } from './model';
import { decide, getDiscoveryState, planTrial, removeTrial, revoke, saveTrial } from './store';
import { useDraftGuard } from '../../components/DraftGuard';

type DraftState = { dirty: boolean; busy: boolean };
type ReportDraft = (id: string, state?: DraftState) => void;
function useChildDraft(id: string, dirty: boolean, busy: boolean, report: ReportDraft) {
  useEffect(() => { report(id, { dirty, busy }); }, [id, dirty, busy, report]);
  useEffect(() => () => report(id), [id, report]);
}

function Sources({ evidence, items, onOpen }: { evidence: Evidence[]; items: Collection[]; onOpen: (item: Collection) => void }) {
  return <details className="discovery-sources"><summary>查看来源原话 · {evidence.length} 件收藏</summary>{evidence.map(source => {
    const current = items.find(item => item.id === source.id);
    return <div key={source.id}>{current ? <button className="text-button" onClick={() => onOpen(current)}>{current.title}</button> : <p>{source.title} · 来源已移除</p>}<blockquote>{source.note}</blockquote></div>;
  })}</details>;
}

function Candidate({ id, evidence, decision, items, onOpen, run, busy, report }: { id: string; evidence: Evidence[]; decision?: Decision; items: Collection[]; onOpen: (item: Collection) => void; run: (action: () => Promise<unknown>) => void; busy: boolean; report: ReportDraft }) {
  const [label, setLabel] = useState(decision?.label || findTheme(id)!.label);
  const [baseline, setBaseline] = useState(decision);
  const [baselineEvidence, setBaselineEvidence] = useState(evidence);
  const sourceSignature = JSON.stringify(evidence.map(source => [source.id, source.note]));
  const clean = label === (baseline?.label || findTheme(id)!.label);
  useChildDraft(`candidate-${id}`, !clean, false, report);
  useEffect(() => { if (clean) { setBaseline(decision); setLabel(decision?.label || findTheme(id)!.label); setBaselineEvidence(evidence); } }, [decision?.revision, sourceSignature, id]);
  async function submit(status: Decision['status']) {
    const actual = await decide(id, label || findTheme(id)!.label, status, baselineEvidence, baseline?.revision);
    setBaseline(actual); setLabel(actual.label); setBaselineEvidence(actual.evidence);
  }
  if (decision?.status === 'confirmed' && clean) return null;
  const current = evidenceCurrent(evidence, items);
  return <article className="discovery-candidate"><div className="discovery-card-heading"><h3>{findTheme(id)!.label}</h3><span>{decision?.status === 'rejected' && evidenceCurrent(decision.evidence, items) ? '已否定' : '待你确认'}</span></div>
    <p>这些原话里可能有一个值得想想的吸引点，需要你判断它是否说中了这份喜欢。</p>
    <Sources evidence={evidence} items={items} onOpen={onOpen} />
    <label className="form-field"><span>吸引点名称</span><input value={label} disabled={busy} maxLength={120} onChange={e => setLabel(e.target.value)} /></label>
    {!current && <p className="discovery-caption">来源已变化，请重新查看理由后再判断。</p>}
    {!clean && !sameEvidence(evidence, baselineEvidence) && <p className="discovery-caption">来源理由已变化，名称草稿仍保留。请重新打开后确认。</p>}
    <div className="discovery-actions"><button className="button outline" disabled={busy || !label.trim() || !current} onClick={() => run(() => submit('confirmed'))}>确认这条线索</button><button className="text-button" disabled={busy || !current} onClick={() => run(() => submit('rejected'))}>这不是我的吸引点</button>{baseline && <button className="text-button" disabled={busy} onClick={() => run(async () => { await revoke(id, baseline.revision); setBaseline(undefined); setLabel(findTheme(id)!.label); })}>撤回判断</button>}</div>
  </article>;
}

function TrialEditor({ trial, items, removed, disabled, report }: { trial: Trial; items: Collection[]; removed: boolean; disabled: boolean; report: ReportDraft }) {
  const [draft, setDraft] = useState(trial), [baseline, setBaseline] = useState(trial);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false), [removing, setRemoving] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const clean = ['status', 'attraction', 'obstacle', 'again', 'next'].every(key => draft[key as keyof Trial] === baseline[key as keyof Trial]);
  useChildDraft(`trial-${trial.id}`, !clean, busy, report);
  const locked = busy || disabled;
  useEffect(() => { if (clean) { setDraft(trial); setBaseline(trial); } }, [trial.revision]);
  const activity = findActivity(trial.activityId)!;
  function update<K extends keyof Trial>(key: K, value: Trial[K]) { setDraft(old => ({ ...old, [key]: value })); setSaved(false); }
  async function save() {
    if (locked || removed) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      const actual = await saveTrial(draft, baseline.revision);
      setDraft(actual); setBaseline(actual); setSaved(true);
    } catch (reason) { setError(storageError(reason)); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (locked || removed) return;
    setBusy(true); setError('');
    try { await removeTrial(trial.id, baseline.revision); }
    catch (reason) { setError(storageError(reason)); }
    finally { setBusy(false); }
  }
  return <article className="discovery-trial" id={`trial-${trial.id}`} tabIndex={-1}><h3>{activity.title}</h3><p className="discovery-caption">来自：{trial.label} · {modeLabels[activity.mode]} · {activity.minutes}</p>
    {removed && <p className="inline-error" role="alert">这份体验已移除。未保存心得仍保留，可以复制后再关闭。</p>}
    {!evidenceCurrent(trial.evidence, items) && <p className="discovery-caption">来源理由已变化，这份体验保留为当时的记录。</p>}
    <button className="text-button" aria-expanded={showInstructions} onClick={() => setShowInstructions(!showInstructions)}>{showInstructions ? '收起体验说明' : '查看怎么开始'}</button>
    {showInstructions && <div className="discovery-instructions"><p>准备：{activity.materials}</p><p>{activity.action}</p><p>{activity.review}</p></div>}
    <div className="discovery-reflection-guide"><p>可以记下：从作品里学到什么，对自己的喜欢多了解了哪一点，还想不想再试。不必每项都回答，也可以暂时没有答案。</p></div>
    <fieldset disabled={locked} className="discovery-reflection"><legend className="sr-only">体验复盘</legend>
      <label className="form-field"><span>体验状态</span><select value={draft.status} onChange={e => update('status', e.target.value as Trial['status'])}><option value="planned">待尝试</option><option value="tried">已体验</option><option value="paused">暂缓</option></select></label>
      <label className="form-field"><span>吸引我的部分</span><textarea aria-label="吸引我的部分" value={draft.attraction} maxLength={2000} rows={2} onChange={e => update('attraction', e.target.value)} placeholder="哪一刻让你想继续？学到什么，或对自己多了解了一点什么？没有也可以留空。" /></label>
      <label className="form-field"><span>遇到的阻碍</span><textarea aria-label="遇到的阻碍" value={draft.obstacle} maxLength={2000} rows={2} onChange={e => update('obstacle', e.target.value)} placeholder="没时间、缺材料、太难，或体验本身不合适……" /></label>
      <label className="form-field"><span>是否愿意再来一次</span><select value={draft.again} onChange={e => update('again', e.target.value as Trial['again'])}><option value="">还没判断</option><option value="yes">愿意</option><option value="no">不愿意</option><option value="unsure">暂时不确定</option></select></label>
      <label className="form-field"><span>下一步</span><textarea aria-label="下一步" value={draft.next} maxLength={2000} rows={2} onChange={e => update('next', e.target.value)} placeholder="再看一段、试试学到的方法、换个样本，或先放一放。" /></label>
    </fieldset><p className="discovery-caption">暂缓和遇到阻碍，都不会自动记成不喜欢。</p>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="discovery-actions"><button className="button outline" disabled={locked || removed || clean} onClick={() => void save()}>保存体验记录</button>{saved && <span role="status">记录已保存</span>}{removing ? <><button className="text-button danger" disabled={locked || removed} onClick={() => void remove()}>确认移除体验</button><button className="text-button" disabled={locked} onClick={() => setRemoving(false)}>保留体验</button></> : <button className="text-button muted" disabled={locked || removed} onClick={() => setRemoving(true)}>移除体验</button>}</div>
  </article>;
}

export function Discovery({ items, onClose, onOpen, initialTrialId }: { items: Collection[]; onClose: () => void; onOpen: (item: Collection) => void; initialTrialId?: string }) {
  const state = useLiveQuery(getDiscoveryState, []);
  // Retain candidates during this visit so a changed/deleted source cannot unmount a name draft.
  const [seenEvidence, setSeenEvidence] = useState<Record<string, Evidence[]>>(() => Object.fromEntries(candidates(items).map(c => [c.id, c.evidence])));
  useEffect(() => { setSeenEvidence(old => ({ ...old, ...Object.fromEntries(candidates(items).map(c => [c.id, c.evidence])) })); }, [items]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [manualTheme, setManualTheme] = useState(themes[0].id), [manualLabel, setManualLabel] = useState(''), [sourceIds, setSourceIds] = useState<string[]>([]);
  const [manualBaseline, setManualBaseline] = useState<Decision>();
  const [sourceEvidence, setSourceEvidence] = useState<Evidence[]>([]);
  useEffect(() => { if (!manualLabel && !sourceIds.length) setManualBaseline(state?.decisions.find(d => d.id === manualTheme)); }, [state, manualTheme]);
  const [trialLimit, setTrialLimit] = useState(10);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const report = useCallback<ReportDraft>((id, next) => setDrafts(old => {
    if (next && old[id]?.dirty === next.dirty && old[id]?.busy === next.busy) return old;
    if (!next && !old[id]) return old;
    const changed = { ...old }; if (next) changed[id] = next; else delete changed[id]; return changed;
  }), []);
  const locked = busy || Object.values(drafts).some(draft => draft.busy);
  const dirty = !!manualLabel.trim() || !!sourceIds.length || Object.values(drafts).some(draft => draft.dirty);
  const { guard, notice } = useDraftGuard(dirty, locked);
  const openSource = (item: Collection) => guard(() => onOpen(item));
  const seenTrials = useRef(new Map<string, Trial>());
  state?.trials.forEach(trial => seenTrials.current.set(trial.id, trial));
  const missingTrials = [...seenTrials.current.values()].filter(trial => !state?.trials.some(current => current.id === trial.id) && (drafts[`trial-${trial.id}`]?.dirty || drafts[`trial-${trial.id}`]?.busy));
  const visibleTrials = [...(state?.trials || []), ...missingTrials];
  const pagedTrials = state?.trials.slice(0, trialLimit) || [];
  // Live inserts must not unmount a draft or pending save at the pagination boundary.
  const retainedTrials = visibleTrials.filter(trial => !pagedTrials.some(current => current.id === trial.id) && (drafts[`trial-${trial.id}`]?.dirty || drafts[`trial-${trial.id}`]?.busy));
  const located = useRef(false);
  useEffect(() => {
    if (!state || !initialTrialId || located.current) return;
    const index = visibleTrials.findIndex(trial => trial.id === initialTrialId);
    if (index >= trialLimit) { setTrialLimit(index + 1); return; }
    located.current = true;
    requestAnimationFrame(() => { const target = document.getElementById(`trial-${initialTrialId}`); target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'start' }); });
  }, [state, initialTrialId, trialLimit]);
  async function run(action: () => Promise<unknown>) {
    if (locked) return;
    setBusy(true); setError(''); setMessage('');
    try { await action(); setMessage('已保存你的选择。'); }
    catch (reason) { setError(storageError(reason)); }
    finally { setBusy(false); }
  }
  const proposed = candidates(items);
  const confirmed = state?.decisions.filter(d => d.status === 'confirmed') || [];
  const notedItems = items.filter(item => item.note.trim());
  const candidateIds = [...new Set([...proposed.map(c => c.id), ...Object.keys(seenEvidence), ...(state?.decisions.map(d => d.id) || [])])];
  return <Modal title="发现我的兴趣" onClose={() => guard(onClose)} closeNotice={notice} className="discovery-modal">
    <p className="modal-intro">从收藏理由中找线索，重新看看真正喜欢的东西：它给了你什么，让你对自己多了解了哪一点？线索需要你判断，之后也可以改变。</p>
    {!state ? <p role="status">正在打开探索记录</p> : <>
      {!notedItems.length && <div className="discovery-empty"><h3>先从一条喜欢的理由开始</h3><p>选一件收藏，写下打动你的瞬间、想主动回去的部分，也可以写不喜欢什么。</p><div className="discovery-actions">{items.slice(0, 4).map(item => <button className="button outline" key={item.id} onClick={() => openSource(item)}>给「{item.title}」写理由</button>)}</div></div>}
      <section className="discovery-section"><h3>值得确认的线索</h3><p className="discovery-caption">这里依据你明确写下的收藏理由找线索，需要你判断。作品名称和点击不作为兴趣证据；没有找到，也可以自己补充。</p>
        {!candidateIds.length && notedItems.length > 0 && <p>还没找到清晰的共同线索。你可以在下方自己选一个方向，并用自己的话命名。</p>}
        {candidateIds.map(id => {
          const decision = state.decisions.find(d => d.id === id);
          const evidence = proposed.find(c => c.id === id)?.evidence || seenEvidence[id] || decision?.evidence || [];
          if (!evidence.length) return null;
          return <Candidate key={id} id={id} evidence={evidence} decision={decision} items={items} onOpen={openSource} run={action => void run(action)} busy={locked} report={report} />;
        })}
      </section>
      {(notedItems.length > 0 || !!manualLabel.trim() || sourceIds.length > 0) && <details className="discovery-manual"><summary>自己补一条吸引点</summary><fieldset className="discovery-reflection discovery-manual-fields" disabled={locked}>
        {!notedItems.length && <p className="discovery-caption">来源理由已移除，名称草稿仍保留。可以先复制，再补写收藏理由。</p>}
        <label className="form-field"><span>吸引方向</span><select value={manualTheme} onChange={e => { setManualTheme(e.target.value); setManualBaseline(state.decisions.find(d => d.id === e.target.value)); }}>{themes.map(theme => <option key={theme.id} value={theme.id}>{theme.label}</option>)}</select></label>
        <label className="form-field"><span>用自己的话命名</span><input value={manualLabel} maxLength={120} onChange={e => { if (!manualLabel && !sourceIds.length) setManualBaseline(state.decisions.find(d => d.id === manualTheme)); setManualLabel(e.target.value); }} placeholder="比如：我喜欢慢慢理解一个人" /></label>
        <fieldset className="discovery-source-picker"><legend>选出能支持这条线索的收藏</legend>{notedItems.slice(0, 100).map(item => <label key={item.id}><input type="checkbox" checked={sourceIds.includes(item.id)} onChange={e => { const checked = e.target.checked; if (!manualLabel && !sourceIds.length) setManualBaseline(state.decisions.find(d => d.id === manualTheme)); setSourceIds(old => checked ? [...old, item.id] : old.filter(id => id !== item.id)); setSourceEvidence(old => checked ? [...old, { id: item.id, title: item.title, note: item.note }] : old.filter(source => source.id !== item.id)); }} />{item.title}</label>)}</fieldset>
        <button className="button outline" disabled={locked || !manualLabel.trim() || !sourceIds.length} onClick={() => void run(async () => {
          const actual = await decide(manualTheme, manualLabel, 'confirmed', sourceEvidence, manualBaseline?.revision);
          setManualBaseline(actual);
          setManualLabel(''); setSourceIds([]); setSourceEvidence([]);
        })}>保存我的吸引点</button><p className="discovery-caption">同一方向保留一条当前判断，可以随时撤回重新命名。</p>
      </fieldset></details>}
      <section className="discovery-section"><h3>从已确认的喜欢出发</h3><p className="discovery-caption">下面是固定的小尝试，供你自己选择；是否适合这份喜欢，需要实际感受后再判断。可以继续欣赏、换种表达，也可以亲手试试。</p>{!confirmed.length && <p>确认一条线索后，这里会给出三个不同方向的小体验。</p>}
        {confirmed.map(decision => <article key={decision.id} className="discovery-confirmed"><div className="discovery-card-heading"><h3>{decision.label}</h3><span>你已确认</span></div>
          <Sources evidence={decision.evidence} items={items} onOpen={openSource} />
          <button className="text-button" disabled={locked} onClick={() => void run(() => revoke(decision.id, decision.revision))}>撤回这条线索</button>
          {!evidenceCurrent(decision.evidence, items) ? <p className="inline-error">来源已变化，请重新确认这条线索。</p> : <div className="discovery-activities">{findTheme(decision.id)!.activities.map(activity => <div key={activity.id} className="discovery-activity"><span className="discovery-kind">{modeLabels[activity.mode]}</span><h4>{activity.title}</h4><p>沿着你确认的「{decision.label}」：{activity.difference}</p><p className="discovery-caption">{activity.minutes} · {activity.materials}</p><p>{activity.action}</p><details><summary>体验后想一想</summary><p>{activity.review}</p></details><button className="button outline" disabled={locked || state.trials.some(t => t.activityId === activity.id && t.status !== 'tried')} onClick={() => void run(() => planTrial(decision, activity.id))}>{state.trials.some(t => t.activityId === activity.id && t.status !== 'tried') ? '已加入清单' : '加入待体验'}</button></div>)}</div>}
        </article>)}
      </section>
      <section className="discovery-section"><h3>我的体验与下一步</h3><p className="discovery-caption">记下欣赏、学习或动手之后的感受，再看看这份喜欢有什么价值。理解由你自己写下；记录不会自动评分或替你作结论。</p>
        {!state.trials.length && <p>选择一项小体验后，就能在这里记录感受和下一步。</p>}
        {[...pagedTrials, ...retainedTrials].map(trial => <TrialEditor key={trial.id} trial={trial} items={items} removed={!state.trials.some(current => current.id === trial.id)} disabled={locked} report={report} />)}
        {visibleTrials.length > trialLimit && <button className="text-button" onClick={() => setTrialLimit(trialLimit + 10)}>查看更早的体验</button>}
      </section>
    </>}{error && <p className="inline-error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
    <p className="discovery-caption">选择与体验记录只保存在本机，包含在完整备份中。</p>
  </Modal>;
}

