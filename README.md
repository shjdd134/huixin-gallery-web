# 会心馆

会于心者，藏于此间。

一个保存在浏览器本地的兴趣收藏馆。可以收藏书籍、影视、音乐、游戏和人物，并记录自己的感受。

## 数据与隐私

新浏览器首次打开为空馆。收藏、图片和手记保存在当前浏览器的 IndexedDB 中，不会提交到这个代码仓库，也没有账号或云同步。请在应用设置里定期导出备份。换设备、浏览器或网址时，请从原地址导出，再到新地址导入。清理浏览器站点数据可能删除收藏。

## 本地开发

使用 Node.js 24：

```sh
npm ci
npm run dev
```

生产构建和本地预览：

```sh
npm run typecheck
npm run build
npm run preview
```

## 发布

推送 main 会触发 GitHub Actions，检查并构建后发布到 GitHub Pages。发布目标为 https://shjdd134.github.io/huixin-gallery-web/ 。在 Actions 中查看结果，发布成功后刷新网页；已打开的旧版可能提示更新，保存编辑后再更新。

项目网址的子目录由工作流设置 HUIXIN_BASE_PATH，本地默认仍是根路径。需要测试子目录产物时，设置 HUIXIN_BASE_PATH=/huixin-gallery-web/，运行 npm run build，再运行 npm run test:pages。

浏览器隔离回归：npm run test:e2e。第三方依赖许可见 THIRD_PARTY/。
