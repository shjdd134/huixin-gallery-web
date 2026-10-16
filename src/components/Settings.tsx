import { useState } from 'react';
import { DownloadSimpleIcon, UploadSimpleIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { Modal } from './Modal';
import { db, storageError } from '../data/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { createBackup, readBackup, restoreBackup, type Backup } from '../data/backup';
import { isNativeApp, saveBackupFile } from '../platform/native';

export function Settings({ count, onClose, onRestored }: { count: number; onClose: () => void; onRestored: () => void }) {
  const hasInterest = useLiveQuery(() => db.collections.filter(item => item.loveLevel === 'interest').count(), [], 0) > 0;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<Backup>();
  async function exportBackup() {
    setBusy(true); setError(''); setMessage('');
    try { const blob = await createBackup(); const nativeSaved = await saveBackupFile(blob, `会心馆_完整备份_${new Date().toLocaleDateString('sv-SE')}.zip`); setMessage(nativeSaved ? '完整备份已保存到你选择的位置，可以传到另一台设备。' : '完整备份已准备好，请保管下载的 ZIP 文件。'); }
    catch (reason) { if (reason instanceof DOMException && reason.name === 'AbortError') setMessage('已取消保存，馆藏没有改变。'); else setError(storageError(reason)); }
    finally { setBusy(false); }
  }
  async function selectBackup(file?: File) {
    if (!file) return;
    setBusy(true); setError(''); setMessage(''); setPending(undefined);
    try { setPending(await readBackup(file)); }
    catch (reason) { setError(storageError(reason)); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!pending) return;
    setBusy(true); setError('');
    try { await restoreBackup(pending); onRestored(); }
    catch (reason) { setError(storageError(reason)); setBusy(false); }
  }
  return <Modal title="馆藏与备份" onClose={() => { if (!busy) onClose(); }} className="settings-modal">
    <div className="privacy-note"><ShieldCheckIcon size={23} weight="light" /><div><strong>你的馆，只属于你</strong><p>{isNativeApp() ? '收藏与感受保存在这台手机内。清除应用数据或卸载会移除馆藏，请保管完整备份。' : '收藏、感受与私人关系只保存在本机，不上传。浏览器清理网站数据会移除收藏，请定期备份。'}</p></div></div>
    <section className="backup-section" aria-labelledby="backup-title">
      <h3 id="backup-title">给喜欢留一份备份</h3><p>完整包包含简介及出处、个人文字、封面、追加记录，以及首页布置、兴趣线索和体验复盘。当前有 {count} 件收藏。</p>
      {hasInterest && <p className="backup-compatibility">含“感兴趣”等级的备份可在新版网页或1.0.2及更新的APK恢复；1.0.1及更早的APK需先更新。</p>}
      <div className="backup-actions"><button className="button outline" onClick={() => void exportBackup()} disabled={busy}><DownloadSimpleIcon size={18} />{busy ? '正在处理' : '导出完整备份'}</button><label className={`button outline file-button ${busy ? 'disabled' : ''}`}><UploadSimpleIcon size={18} />从备份恢复<input type="file" accept=".zip,application/zip" aria-label="选择会心馆备份" disabled={busy} onChange={event => { void selectBackup(event.target.files?.[0]); event.target.value = ''; }} /></label></div>
      {pending && <div className="restore-confirm" role="alert"><strong>已校验：{pending.items.length} 件收藏</strong><p>恢复将替换本机现有的 {count} 件收藏。简介和出处也随备份恢复，旧备份没有简介时会留空。兴趣线索和体验记录也会随备份替换；旧备份没有这些记录时会清空现有探索记录。建议先导出当前馆藏。</p><div><button className="button primary" disabled={busy} onClick={() => void restore()}>确认替换并恢复</button><button className="text-button" disabled={busy} onClick={() => setPending(undefined)}>取消</button></div></div>}
      {error && <p className="inline-error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
    </section>
    <div className="about-opening"><span className="about-seal" aria-hidden="true">会心</span><h3>把真正喜欢的世界留下来。</h3><p>一本舍不得合上的书，一部散场后仍记得的电影，一首反复听的歌，一个想回去的世界，或一个照亮过你的人。</p><p>这里收藏的，是它们与你的关系。</p></div>
    <div className="install-note"><h3>{isNativeApp() ? '把馆藏带到这台手机' : '让会心馆陪你久一点'}</h3><p>{isNativeApp() ? '在电脑或旧手机导出完整备份，把ZIP传到这台手机，再点上方「从备份恢复」。应用已内置全部资源，可以离线使用。后续使用同一签名的新版APK覆盖安装，保留本机馆藏。' : '在支持安装的浏览器里，使用菜单中的「安装应用」或「添加到主屏幕」。首次缓存完成后，可以离线查看和编辑已保存的收藏。'}</p></div>
  </Modal>;
}
