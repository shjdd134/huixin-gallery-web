import { db } from '../../data/db';
import { findActivity } from './catalog';
import { emptyDiscovery, evidenceCurrent, validateDiscovery, type Decision, type DiscoveryState, type Evidence, type Trial } from './model';
export const DISCOVERY_KEY = 'interest-discovery-v1';
export async function getDiscoveryState(): Promise<DiscoveryState> {
  const row = await db.meta.get(DISCOVERY_KEY);
  return row ? validateDiscovery(JSON.parse(row.value)) : emptyDiscovery();
}
function checkRevision(actual: string | undefined, expected: string | undefined) {
  if (actual !== expected) throw new Error('这条探索记录已在另一个页面改动，请关闭并重新打开后再保存。当前填写的内容仍保留。');
}
async function mutate(action: (state: DiscoveryState) => Promise<void> | void) {
  await db.transaction('rw', db.meta, db.collections, async () => {
    const state = await getDiscoveryState();
    await action(state);
    await db.meta.put({ key: DISCOVERY_KEY, value: JSON.stringify(validateDiscovery(state)) });
  });
}
export async function decide(id: string, label: string, status: Decision['status'], evidence: Evidence[], expected?: string) {
  let saved!: Decision;
  await mutate(async state => {
    const old = state.decisions.find(d => d.id === id); checkRevision(old?.revision, expected);
    if (!evidenceCurrent(evidence, await db.collections.toArray())) throw new Error('来源理由已改变，请重新查看后确认。');
    const next: Decision = { id, label: label.trim(), status, evidence, revision: crypto.randomUUID() };
    saved = next;
    state.decisions = [...state.decisions.filter(d => d.id !== id), next];
  });
  return saved;
}
export async function revoke(id: string, expected: string) {
  await mutate(state => { checkRevision(state.decisions.find(d => d.id === id)?.revision, expected); state.decisions = state.decisions.filter(d => d.id !== id); });
}
export async function planTrial(decision: Decision, activityId: string) {
  await mutate(async state => {
    checkRevision(state.decisions.find(d => d.id === decision.id)?.revision, decision.revision);
    if (decision.status !== 'confirmed' || !evidenceCurrent(decision.evidence, await db.collections.toArray()) || findActivity(activityId)?.themeId !== decision.id) throw new Error('请先重新确认体验对应的兴趣线索。');
    if (state.trials.some(t => t.activityId === activityId && t.status !== 'tried')) throw new Error('这项体验已在清单里，可在下方继续或记录结果。');
    const now = new Date().toISOString();
    state.trials.unshift({ id: crypto.randomUUID(), themeId: decision.id, activityId, label: decision.label, evidence: decision.evidence, status: 'planned', attraction: '', obstacle: '', again: '', next: '', createdAt: now, updatedAt: now, revision: crypto.randomUUID() });
  });
}
export async function saveTrial(trial: Trial, expected: string) {
  let saved!: Trial;
  await mutate(state => {
    const index = state.trials.findIndex(t => t.id === trial.id);
    checkRevision(state.trials[index]?.revision, expected);
    if (index < 0) throw new Error('体验记录已移除。');
    const old = state.trials[index];
    state.trials[index] = saved = { ...old, status: trial.status, attraction: trial.attraction, obstacle: trial.obstacle, again: trial.again, next: trial.next, updatedAt: new Date().toISOString(), revision: crypto.randomUUID() };
  });
  return saved;
}
export async function removeTrial(id: string, expected: string) {
  await mutate(state => { checkRevision(state.trials.find(t => t.id === id)?.revision, expected); state.trials = state.trials.filter(t => t.id !== id); });
}
