import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/noto-serif-sc/chinese-simplified-400.css';
import '@fontsource/noto-serif-sc/latin-400.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import App, { AppBoundary } from './App';
import { db, storageError } from './data/db';
import { UpdateNotice } from './components/UpdateNotice';
import './styles/base.css';
import './features/discovery/discovery.css';
import './styles/gallery.css';
import './styles/covers.css';
import './styles/dialogs.css';
import './styles/update-notice.css';
import './styles/mobile.css';
import { initializeNative, isNativeApp } from './platform/native';
declare const __BUILD_TAG__: string;
document.documentElement.dataset.buildTag = __BUILD_TAG__;
initializeNative();
if (!isNativeApp()) {
  const noticeRoot = document.createElement('div');
  noticeRoot.id = 'update-notice-root';
  document.body.appendChild(noticeRoot);
  ReactDOM.createRoot(noticeRoot).render(<UpdateNotice />);
}
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<div className="fatal-error" role="status"><span className="brand-seal">会</span><p>正在打开你的会心馆</p></div>);
db.open().then(() => {
  root.render(<React.StrictMode><AppBoundary><App /></AppBoundary></React.StrictMode>);
}).catch(error => {
  root.render(<div className="fatal-error"><span className="brand-seal">会</span><h1>暂时无法打开会心馆</h1><p>{storageError(error)}</p><button className="button primary" onClick={() => location.reload()}>重新打开</button></div>);
});
