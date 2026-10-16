import type { Collection } from '../../data/db';
import { findActivity, findTheme, themes } from './catalog';

export interface Evidence { id: string; title: string; note: string }
export interface Decision { id: string; label: string; status: 'confirmed' | 'rejected'; evidence: Evidence[]; revision: string }
export interface Trial { id: string; themeId: string; activityId: string; label: string; evidence: Evidence[]; status: 'planned' | 'tried' | 'paused'; attraction: string; obstacle: string; again: '' | 'yes' | 'no' | 'unsure'; next: string; createdAt: string; updatedAt: string; revision: string }
export interface DiscoveryState { decisions: Decision[]; trials: Trial[] }
export const emptyDiscovery = (): DiscoveryState => ({ decisions: [], trials: [] });
// Treat a negative clause conservatively; it must not cancel another clause.
// These local word rules propose clues, rather than interpret every sentence.
const clauseBreak = /[。！？.!?\n，,；;]|但是|不过|然而|可是|但|却|而(?:是)?|也喜欢/;
const negativeReason = /不(?:是)?(?:太|很|怎么|大|那么|特别)?(?:喜欢|感兴趣|想)|并非|不爱|讨厌|厌恶|(?:没(?:有)?|毫无)(?:什么)?兴趣|并不/;
// Remove an explicitly absent feature, retaining what follows the noun phrase:
// “没有复杂人物关系的故事” is evidence about the story, not relationships.
const absentFeature = /(?:没有|并无|毫无|无需|不需要|不必|不含|缺少|缺乏)(?:(?:复杂|高难度|激烈|太多|繁琐|困难)的)?[^的，,。；;！？!\n]{0,24}(?:的|$)/g;
// A bare "自己" often only identifies who enjoyed something. Require words
// about reflection or an explicit act/object of understanding oneself.
const reflectionReason = /思考|意义|人生|成长|哲学|选择|(?:理解|了解|认识|审视|反省|反思|看清|接纳)(?:了)?(?:我?自己|自我)|(?:我?自己|自我)(?:的)?(?:内心|价值观|需求|愿望|困惑|想法|感受)/;
export function evidenceFor(items: Collection[], themeId: string): Evidence[] {
  const theme = findTheme(themeId);
  if (!theme) return [];
  const pattern = themeId === 'reflect' ? reflectionReason : theme.pattern;
    return items.filter(item => item.note.trim() && item.note.split(clauseBreak).some(part => !negativeReason.test(part) && pattern.test(part.replace(absentFeature, ' '))))
    .slice(0, 100).map(item => ({ id: item.id, title: item.title, note: item.note }));
}
export function candidates(items: Collection[]) { return themes.map(theme => ({ ...theme, evidence: evidenceFor(items, theme.id) })).filter(theme => theme.evidence.length); }
export function evidenceCurrent(evidence: Evidence[], items: Collection[]) { return evidence.length > 0 && evidence.every(source => items.some(item => item.id === source.id && item.note === source.note && item.note.trim())); }
export function sameEvidence(left: Evidence[], right: Evidence[]) { return left.length === right.length && left.every(source => right.some(other => other.id === source.id && other.note === source.note)); }

const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const id = (v: unknown): v is string => text(v, 80) && /^[a-zA-Z0-9-]{1,80}$/.test(v);
const date = (v: unknown): v is string => text(v, 60) && Number.isFinite(Date.parse(v));
function sources(value: unknown): Evidence[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw new Error('探索线索的来源无效。');
  const seen = new Set<string>();
  return value.map(source => {
    if (!source || !id(source.id) || seen.has(source.id) || !text(source.title, 120) || !source.title.trim() || !text(source.note, 10000) || !source.note.trim()) throw new Error('探索线索的来源无效。');
    seen.add(source.id); return { id: source.id, title: source.title, note: source.note };
  });
}
/** Shared validation for local writes and untrusted backup files; unknown fields discarded. */
export function validateDiscovery(value: unknown): DiscoveryState {
  if (!value || typeof value !== 'object') throw new Error('兴趣探索记录无效。');
  const state = value as DiscoveryState;
  if (!Array.isArray(state.decisions) || state.decisions.length > themes.length || !Array.isArray(state.trials) || state.trials.length > 1000) throw new Error('兴趣探索记录无效或超出容量。');
  const decisionIds = new Set<string>(), trialIds = new Set<string>();
  const decisions = state.decisions.map(d => {
    if (!d || !findTheme(d.id) || decisionIds.has(d.id) || !text(d.label, 120) || !d.label.trim() || !['confirmed', 'rejected'].includes(d.status) || !id(d.revision)) throw new Error('兴趣线索记录无效。');
    decisionIds.add(d.id); return { id: d.id, label: d.label, status: d.status, evidence: sources(d.evidence), revision: d.revision };
  });
  const trials = state.trials.map(t => {
    if (!t || !id(t.id) || trialIds.has(t.id) || !id(t.revision) || !findTheme(t.themeId) || findActivity(t.activityId)?.themeId !== t.themeId || !text(t.label, 120) || !t.label.trim() || !['planned', 'tried', 'paused'].includes(t.status) || !text(t.attraction, 2000) || !text(t.obstacle, 2000) || !['', 'yes', 'no', 'unsure'].includes(t.again) || !text(t.next, 2000) || !date(t.createdAt) || !date(t.updatedAt)) throw new Error('体验记录无效。');
    trialIds.add(t.id); return { id: t.id, themeId: t.themeId, activityId: t.activityId, label: t.label, evidence: sources(t.evidence), status: t.status, attraction: t.attraction, obstacle: t.obstacle, again: t.again, next: t.next, createdAt: t.createdAt, updatedAt: t.updatedAt, revision: t.revision };
  });
  return { decisions, trials };
}
