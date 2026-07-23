# 國民健康署 AI 簡報教育訓練公開入口

這是一個純靜態 GitHub Pages 網站，公開三梯六場的完整學習內容與「已開放／尚未開放」狀態。學員免登入；網站不報名、不顯示名單、不驗證資格，也不蒐集個人資料。

## 系統構成

- `docs/`：GitHub Pages 唯一發布目錄。
- `docs/data/course-catalog.json`：三梯六場的公開課程資料。
- `docs/data/courses/`：三階完整教學內容，包含 NotebookLM 操作步驟、提示詞、實作、檢核、評量與投影片藍圖。
- `docs/data/instructor-prompts.json`：5 組共用與每階 2 組講師簡報生成提示詞，共 11 組。
- `docs/data/availability.json`：六場的公開開放狀態；預設為 fail-closed。
- `docs/sessions/session-01/` 至 `session-06/`：六場可由首頁入口直接到達的完整課程頁；同一階的兩場共用同一份教學內容。
- `docs/assets/course-page.js`：在瀏覽器載入課程內容、複製提示詞、保存本機檢核進度與顯示講師模式。
- `docs/assets/images/hpa-logo.png` 與 `hpa-favicon.ico`：國民健康署官方 Logo 與網站圖示；來源為國健署官方網站。
- `.github/workflows/deploy-pages.yml`：`main` 有 push 或人工執行時，先驗證再發布。
- `.github/workflows/manage-availability.yml`：GitHub 登入後以六個 checkbox 完整覆寫開放狀態，留下 commit 紀錄並在同次 workflow 發布。
- `scripts/`：只使用 Node.js 內建模組的資料、公開安全與可及性檢查。

## 第一次啟用 GitHub Pages

1. 建立新的公開 GitHub repository，僅推送本資料夾內容；不要把上層客戶工作區加入 repo。
2. 在 repository 的 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。
3. 確認預設 branch 為 `main`。
4. 在 **Settings → Actions → General → Workflow permissions** 允許 workflow 依 YAML 取得所需寫入權限。若組織政策禁止 `contents: write`，管理 workflow 無法提交狀態，需由組織管理員調整。
5. 開啟 **Actions → Deploy GitHub Pages → Run workflow**，Branch 選 `main`。
6. workflow 全綠後，從 deployment 顯示的 URL 進入網站。

GitHub CLI 的登入、建立 repo、push 與 Pages 啟用都屬外部發布動作，應由 repository 擁有者確認後執行。

## 本機驗證

需要 Node.js 20 以上，不需 `npm install`。

```powershell
npm run serve
npm test
npm run validate
npm run validate:initial
```

`npm run serve` 會在 `http://127.0.0.1:8765/` 啟動本機預覽；按 `Ctrl+C` 停止。

課程頁的檢核進度只保存在該瀏覽器的 `localStorage`，不會送到 GitHub、國民健康署或其他伺服器。頁面不提供自由文字欄位，並持續提醒不得輸入個資、未公開公文、敏感案件或未授權資料。

`validate:initial` 只用於首次上線檢查「僅 `session-01` 開放」。日後狀態改變後，請用一般 `npm run validate`，或自行指定完整預期清單：

```powershell
node scripts/validate-site.mjs --expect-open=session-01,session-03
node scripts/validate-site.mjs --expect-open=
```

驗證器會檢查：

- 恰好三梯、每梯兩場、共六場，以及 120 分鐘流程。
- 六場均有安全、固定且可到達的 `sessions/<session-id>/` 內容頁，頁面 ID 與場次一致。
- 三階內容資料均為有效 JSON，120 分鐘流程、學員與講師 NotebookLM 提示詞、實作、檢核、評量與投影片藍圖完整。
- `availability.json` 六個 session 均有明確 boolean，且 `defaultOpen` 固定為 `false`。
- 可用參數核對完整開放清單。
- 已取消的兩項簡報修改主題不在 `docs/`。
- repo 內沒有敏感檔名、Office/PDF/CSV/資料庫/影音/壓縮檔或憑證檔。
- HTML 基本語意與可及性、片段連結、CSS/JS/圖片/JSON 本機路徑。

場次操作請看 [ADMIN_GUIDE.md](ADMIN_GUIDE.md)，公開資料界線請看 [PUBLIC_CONTENT_POLICY.md](PUBLIC_CONTENT_POLICY.md)。

品牌視覺以[國民健康署官方網站](https://www.hpa.gov.tw/home/index.aspx)及其官方 Logo 為準；本站明示為課程專用入口，不取代國民健康署官網。
