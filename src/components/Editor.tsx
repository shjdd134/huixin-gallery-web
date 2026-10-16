import { useState, type FormEvent } from 'react';
import { ImageIcon, CheckIcon, CaretDownIcon } from '@phosphor-icons/react';
import { Modal } from './Modal';
import { useBlobUrl } from './Image';
import { newCollection, saveCollection, storageError, ENCOUNTER_TEXT_MAX, QUOTE_MAX, type Collection } from '../data/db';
import { spaces, getSpace, defaultSubtype, type SpaceId } from '../data/spaces';
import { compressCover } from '../data/images';
import { INTRODUCTION_MAX } from '../data/introduction';
import { useDraftGuard } from './DraftGuard';

export function Editor({ existing, initialSpace, initialSubtype, onClose, onSaved, onBatch }: { existing?: Collection; initialSpace: SpaceId; initialSubtype?: string; onClose: () => void; onSaved: (item: Collection) => void; onBatch?: () => void }) {
  const [item, setItem] = useState<Collection>(() => existing
    ? { ...existing, tags: [...existing.tags], encounterText: existing.encounterText ?? '', quote: existing.quote ?? '' }
    : { ...newCollection(initialSpace), subtype: initialSubtype || defaultSubtype(initialSpace) });
  const [tagsText, setTagsText] = useState(item.tags.join('，'));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [baseline] = useState(() => ({ item, tagsText }));
  const dirty = tagsText !== baseline.tagsText || item.cover !== baseline.item.cover || item.thumbnail !== baseline.item.thumbnail
    || (['title', 'space', 'subtype', 'creator', 'url', 'loveLevel', 'note', 'filmList', 'encounterText', 'quote', 'treasure', 'revisit', 'introduction'] as const)
      .some(key => JSON.stringify(item[key]) !== JSON.stringify(baseline.item[key]));
  const { guard, notice } = useDraftGuard(dirty, busy || imageBusy);
  const coverUrl = useBlobUrl(item.cover);
  const space = getSpace(item.space);
  function update<K extends keyof Collection>(key: K, value: Collection[K]) { setItem(old => ({ ...old, [key]: value })); }
  function editIntroduction(text: string) {
    setItem(old => ({ ...old, introduction: { text, sourceName: old.introduction?.sourceName || '', sourceUrl: old.introduction?.sourceUrl || '', kind: 'edited' } }));
  }
  async function upload(file?: File) {
    if (!file) return;
    setImageBusy(true); setError('');
    try { const image = await compressCover(file); setItem(old => ({ ...old, ...image })); }
    catch (reason) { setError(storageError(reason)); }
    finally { setImageBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    const saved = { ...item, tags: tagsText.split(/[,，、\n]/), subtype: ['book', 'music', 'film'].includes(item.space) ? item.subtype : '', filmList: item.space === 'film' ? item.filmList.trim() : '' };
    try { const actual = await saveCollection(saved, existing); onSaved(actual); }
    catch (reason) { setError(storageError(reason)); setBusy(false); }
  }
  return <Modal title={existing ? '编辑这份喜欢' : '留下新的喜欢'} onClose={() => guard(onClose)} closeNotice={notice} className="editor-modal"><form onSubmit={submit}><fieldset className="editor-fields" disabled={busy || imageBusy}>
    <p className="modal-intro">{item.space === 'website' ? '填写名称与网址，再写下它能帮你做什么。' : '只填名称，就可以先留下。其余的，慢慢补。'}</p>
    <div className={`editor-basic ${item.space === 'website' ? 'website-basic' : ''}`}>{item.space !== 'website' && <label className={`cover-uploader ${coverUrl ? 'has-cover' : ''}`}><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" aria-label="上传封面" disabled={imageBusy || busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />{coverUrl ? <img src={coverUrl} alt="封面预览" /> : <ImageIcon size={28} weight="light" />}<span>{imageBusy ? '正在处理' : coverUrl ? '更换封面' : '添加封面'}</span></label>}<div className="editor-primary-fields"><label className="form-field"><span>{item.space === 'website' ? '网站名称' : '名称'} <span className="required-note">必填</span></span><input autoFocus data-autofocus value={item.title} onChange={event => update('title', event.target.value)} aria-label={item.space === 'website' ? '网站名称' : undefined} placeholder={item.space === 'person' ? '一个你想记住的人' : item.space === 'website' ? '常用的网站或工具' : '一件你真正喜欢的作品'} required maxLength={120} /></label><div className="form-row"><label className="form-field"><span>放进哪个空间</span><select value={item.space} onChange={event => { const next = event.target.value as SpaceId; setItem(old => ({ ...old, space: next, subtype: defaultSubtype(next) })); }}>{spaces.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}</select></label>{item.space === 'book' && <label className="form-field"><span>类别</span><select value={item.subtype} onChange={event => update('subtype', event.target.value)}><option value="traditional">传统文学</option><option value="web">网文</option><option value="light">轻小说</option></select></label>}{item.space === 'film' && <label className="form-field"><span>类别</span><select value={item.subtype || 'movie'} onChange={event => update('subtype', event.target.value)}><option value="movie">电影</option><option value="series">电视剧</option></select></label>}{item.space === 'music' && <label className="form-field"><span>类别</span><select value={item.subtype} onChange={event => update('subtype', event.target.value)}><option value="song">歌曲</option><option value="artist">歌手</option></select></label>}</div></div></div>
    {coverUrl && <button type="button" className="text-button remove-cover" onClick={() => setItem(old => ({ ...old, cover: undefined, thumbnail: undefined }))}>移除封面</button>}
    {item.space === 'website' && <label className="form-field website-url-field"><span>网站地址 <span className="required-note">必填</span></span><input aria-label="网站地址" value={item.url || ''} onChange={event => update('url', event.target.value)} placeholder="https://example.com" required maxLength={2048} autoCapitalize="none" autoCorrect="off" spellCheck={false} /><small>可粘贴完整网址；没有协议时默认使用 https。</small></label>}
    <div className="editor-reason"><label className="form-field"><span>{space.noteLabel}</span><textarea aria-label={space.noteLabel} value={item.note} onChange={event => update('note', event.target.value)} placeholder={item.space === 'website' ? '这个网站可以做什么？你通常在什么情况下使用它？' : '一个瞬间、一句话，或一种感觉……'} maxLength={10000} rows={4} /></label></div>
    <details className="optional-details" open={!!existing || undefined}><summary>更多收藏信息<span>选填 <CaretDownIcon size={15} /></span></summary><div className="optional-body"><label className="form-field"><span>{space.creatorLabel}</span><input value={item.creator} maxLength={120} onChange={event => update('creator', event.target.value)} placeholder="可以之后再补" /></label><label className="form-field"><span>什么时候遇见</span><input value={item.encounterText ?? ''} maxLength={ENCOUNTER_TEXT_MAX} onChange={event => update('encounterText', event.target.value)} placeholder="比如：高中暑假、朋友的推荐、一个失眠的晚上" /></label><label className="form-field"><span>最喜欢的一句话</span><textarea value={item.quote ?? ''} rows={2} maxLength={QUOTE_MAX} onChange={event => update('quote', event.target.value)} placeholder="书里、戏里或歌词里，打动你的那一句" /></label><label className="form-field"><span>自己的标签</span><input value={tagsText} onChange={event => setTagsText(event.target.value)} maxLength={600} placeholder={item.space === 'website' ? '用逗号分开，比如：工具，学习，工作' : '用逗号分开，比如：温柔，想重读'} /><small>最多 12 个标签。</small></label>{item.space === 'film' && <label className="form-field"><span>私藏影单</span><input value={item.filmList} maxLength={80} onChange={event => update('filmList', event.target.value)} placeholder="给你的影单起个名字" /></label>}</div></details>
    {item.space !== 'website' && <label className="form-field editor-introduction"><span>{item.space === 'music' && item.subtype === 'artist' ? '歌手简介' : item.space === 'person' ? '人物简介' : '作品简介'}</span><textarea aria-label={item.space === 'music' && item.subtype === 'artist' ? '歌手简介' : item.space === 'person' ? '人物简介' : '作品简介'} value={item.introduction?.text || ''} onChange={event => editIntroduction(event.target.value)} maxLength={INTRODUCTION_MAX} rows={4} placeholder="可以补充一段介绍，与自己的喜欢理由分开。" /><small>{item.introduction?.kind === 'official-summary' ? '据官方资料整理；修改后会标注为自行编辑。' : '选填，最多2000字。'}{item.introduction?.sourceUrl && <> <a href={item.introduction.sourceUrl} target="_blank" rel="noopener noreferrer">查看参考来源 ↗</a></>}</small></label>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="modal-footer"><div className="footer-side"><span>只保存在这台设备</span>{!existing && onBatch && item.space !== 'website' && <button type="button" className="text-button" onClick={() => guard(onBatch)}>批量录入书单 / 片单</button>}</div><button type="submit" className="button primary" disabled={busy || imageBusy}><CheckIcon size={19} weight="light" />{busy ? '正在保存' : existing ? '保存修改' : item.space === 'website' ? '保存网站' : '留下这份喜欢'}</button></div>
  </fieldset></form></Modal>;
}
