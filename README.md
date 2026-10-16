# 会心馆

会于心者，藏于此间。

一个保存在浏览器本地的兴趣收藏馆。可以收藏书籍、影视、人物和常用网站，并记录自己的感受。

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

日常修改完成并本地预览后，在工程目录执行：

```sh
npm run typecheck
npm run build
git status
git add .
git commit -m "更新会心馆"
git push
```

推送成功后，在仓库 Actions 中等待 Publish GitHub Pages 显示成功，再访问新网址。构建失败时先查看日志并修复；网站会继续保留上次成功部署的版本。仓库中的代码和提交记录公开，不要加入真实收藏备份、私人手记或签名文件。

项目网址的子目录由工作流设置 HUIXIN_BASE_PATH，本地默认仍是根路径。需要测试子目录产物时，设置 HUIXIN_BASE_PATH=/huixin-gallery-web/，运行 npm run build，再运行 npm run test:pages。

浏览器隔离回归：npm run test:e2e。第三方依赖许可见 THIRD_PARTY/。

## 网站收藏

填写名称、网址和网站用途，可以添加标签、搜索并直接打开网站。网站信息手动填写，不会自动抓取外部网页。

原音乐、游戏入口已移除；旧数据仍保留在本机，并包含在完整备份中。含网站的备份使用 v6，需在支持网站收藏的新版网页恢复，旧网页和旧 APK 无法读取。
