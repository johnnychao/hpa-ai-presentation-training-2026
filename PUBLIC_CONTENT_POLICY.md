# 公開內容政策

本 repository 與 GitHub Pages 預設為網際網路公開。即使畫面沒有顯示連結，只要檔案曾被 commit 或部署，就不能視為保密。

## 可以公開

- 已核准的課程名稱、梯次、日期、時段、難度、目標、主軸與學員產出。
- 課程流程與一般使用說明。
- 每場「已開放／尚未開放」狀態。
- 專為本網站生成、沒有真人識別資訊的微縮卡通情境圖。
- 由國民健康署官方網站取得、用於本課程識別的官方 Logo。
- 網站 HTML、CSS、JavaScript、公開 JSON 與維運文件。

## 不得公開

- 姓名、電子郵件、電話、身分證字號、員工編號、IP、帳號或其他個人識別資料。
- 報名表、學員名單、簽到表、回饋原始資料、出席紀錄或資格判定。
- 簽名文件、報價、預算、契約、內部公文、未公開研究或未核准教材。
- 會議連結、會議密碼、僅限學員的下載網址或任何以隱藏 URL 代替權限控管的內容。
- API key、GitHub token、Google token、密碼、私鑰、`.env` 或系統設定秘密。
- Office 文件、PDF、CSV、資料庫、影音原檔與壓縮包。
- 已由需求撤回的額外簡報修改主題。

## 開放狀態的界線

`availability.json` 只是公開介面的顯示設定：

- `isOpen: true`：顯示「已開放」入口。
- `isOpen: false`：顯示「尚未開放」。
- `defaultOpen: false`：資料讀取失敗時全部關閉。

這不是登入、授權或存取控制。若教材必須只給特定學員，應使用機關核准的 Google Workspace、Microsoft 365、LMS 或其他具身分驗證的系統。

六個場次內容頁都會隨 GitHub Pages 公開部署；未開放時只是不在首頁提供入口，知道網址者仍可能直接瀏覽。

## 品牌來源

- 官方網站：<https://www.hpa.gov.tw/home/index.aspx>
- 官方 Logo：<https://www.hpa.gov.tw/NewPageStyle/TW/images/logo/logo.png>
- 官方網站圖示：<https://www.hpa.gov.tw/NewPageStyle/TW/images/favicon.ico>
- 本站使用官方 Logo 與官方網站的綠、青綠、灰色系，並標示「課程專用入口」，不冒充或取代國民健康署官網。

## 上線前檢查

每次 Pages 部署都會執行 `node scripts/validate-site.mjs`，阻擋：

- 不符合三梯六場契約的資料。
- 已取消內容文字。
- 敏感檔名與高風險副檔名。
- 缺少的圖片、CSS、JavaScript、JSON 或錯誤片段連結。
- 基本 HTML 語意與可及性錯誤。

自動檢查不能取代人工審查。新增公開內容前，仍應由內容負責人確認資料已核准、無個資且適合永久公開。
