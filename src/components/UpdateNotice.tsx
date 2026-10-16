import { useEffect, useRef, useState } from 'react';
import { ArrowsClockwiseIcon, XIcon } from '@phosphor-icons/react';
import { registerSW } from 'virtual:pwa-register';

/**
 * 独立的更新提示，挂在 App 之外，不依赖任何页面组件。
 * 只在用户点击「更新到新版」时才刷新页面：绝不强制刷新，
 * 正在编辑的内容由用户自己选择保存时机。暂不更新只在本页面
 * 会话内静默；下次打开若有待更新版本会再次提示。
 */
export function UpdateNotice() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const applyUpdate = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() { setNeedRefresh(true); },
      onRegisteredSW(_url, registration) {
        // 应用可能长期不关闭：聚焦和定时重新检查，让新版本能被主动发现。
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registration?.update().catch(() => undefined);
        });
        window.setInterval(() => void registration?.update().catch(() => undefined), 30 * 60 * 1000);
      },
      onRegisterError() { /* 无 SW 环境（如开发热更新）保持安静。 */ },
    });
    applyUpdate.current = () => { setUpdating(true); updateSW(true); };
  }, []);
  if (!needRefresh || dismissed) return null;
  return <div className="update-notice" role="status" aria-live="polite">
    <div className="update-notice-text">
      <strong>会心馆有新版本</strong>
      <p>更新会刷新页面；正在编辑的内容请先保存。</p>
    </div>
    <div className="update-notice-actions">
      <button className="button primary update-apply" onClick={() => applyUpdate.current?.()} disabled={updating}>
        <ArrowsClockwiseIcon size={17} weight="light" />{updating ? '正在更新' : '更新到新版'}
      </button>
      <button className="text-button update-dismiss" onClick={() => setDismissed(true)} disabled={updating} aria-label="暂不更新">
        <XIcon size={16} />暂不
      </button>
    </div>
  </div>;
}
