import { requestDraftNavigation } from '../components/DraftGuard';

declare const __ANDROID_APP__: boolean;
type Reply = { id?: string; ok?: boolean; result?: { name?: string }; error?: string; cancelled?: boolean; event?: string; visible?: boolean };
type Pending = { resolve: (value: Reply['result']) => void; reject: (reason: Error) => void; timer?: number };
export const isNativeApp = () => __ANDROID_APP__;
let port: MessagePort | undefined, sequence = 0, initialized = false;
const pending = new Map<string, Pending>();
let ready: Promise<void>, readyResolve: () => void;

export function initializeNative() {
  if (!isNativeApp() || initialized) return;
  initialized = true;
  document.documentElement.dataset.platform = 'android';
  ready = new Promise(resolve => { readyResolve = resolve; });
  window.addEventListener('message', event => {
    if (port || event.data !== 'huixin-native-connect-v1' || event.ports.length !== 1 || event.source && event.source !== window) return;
    port = event.ports[0];
    port.onmessage = ({ data }) => {
      let reply: Reply; try { reply = JSON.parse(data); } catch { return; }
      if (reply.event === 'ime') { document.documentElement.classList.toggle('native-keyboard', reply.visible === true); return; }
      if (reply.event === 'back') {
        const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
        if (dialog) { dialog.dispatchEvent(new Event('cancel', { cancelable: true })); return; }
        const leave = () => { void request('navigate-back').catch(() => undefined); };
        if (requestDraftNavigation(leave)) leave();
        return;
      }
      const task = reply.id && pending.get(reply.id); if (!task) return;
      pending.delete(reply.id!); if (task.timer) clearTimeout(task.timer);
      if (reply.ok) task.resolve(reply.result);
      else task.reject(reply.cancelled ? new DOMException('已取消保存', 'AbortError') : new Error(reply.error || '手机文件操作失败，请重新尝试。'));
    };
    port.start(); readyResolve();
  });
}

async function request(op: string, details: Record<string, unknown> = {}, waitForPicker = false) {
  if (!port) {
    initializeNative();
    await Promise.race([ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('手机文件服务尚未就绪，请重新打开应用。')), 5000))]);
  }
  const id = String(++sequence);
  return new Promise<Reply['result']>((resolve, reject) => {
    const task: Pending = { resolve, reject };
    if (!waitForPicker) task.timer = window.setTimeout(() => { pending.delete(id); reject(new Error('手机文件写入超时，请重试。')); }, 30000);
    pending.set(id, task); port!.postMessage(JSON.stringify({ id, op, ...details }));
  });
}

export async function saveBackupFile(blob: Blob, name: string): Promise<boolean> {
  if (!isNativeApp()) {
    const link = document.createElement('a'), url = URL.createObjectURL(blob);
    link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000); return false;
  }
  if (blob.size > 100 * 1024 * 1024) throw new Error('完整备份超过手机保存的100MB上限。');
  let started = false;
  try {
    await request('export-start', { name, size: blob.size }, true); started = true;
    const chunkSize = 192 * 1024;
    for (let offset = 0, seq = 0; offset < blob.size; offset += chunkSize, seq++) {
      const bytes = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
      let binary = ''; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      await request('export-chunk', { seq, data: btoa(binary) });
    }
    await request('export-finish'); return true;
  } catch (reason) {
    if (started) await request('export-abort').catch(() => undefined);
    throw reason;
  }
}
