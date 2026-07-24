# 場次開放狀態操作手冊

管理入口使用 GitHub 原生 Actions 權限。只有 repository 擁有者或具有 write 權限的協作者可以操作；公開網站不會出現管理入口。

## 最重要的規則

每次執行都要勾選「這一次完成後，應維持開放的全部場次」。

- 勾選＝該場開放。
- 未勾選＝該場關閉。
- 六個 checkbox 是完整快照，不是只新增一場的增量操作。

例如目前第1、2場都要開放，必須同時勾第1場與第2場。若只勾第2場，第1場會被關閉。

## 操作步驟

1. 登入 GitHub 並進入本 repository。
2. 點選 **Actions**。
3. 左側點選 **管理場次開放狀態**。
4. 點選 **Run workflow**。
5. Branch 必須選 `main`；選其他 branch 會被 workflow 主動拒絕。
6. 逐一確認六場，勾選本次完成後應保持開放的完整清單。
7. 再檢查一次所有 checkbox，點綠色 **Run workflow**。
8. 等待 `Update, validate, and package` 與 `Deploy selected state` 都變成綠色。
9. 從 deployment URL 開啟網站，重新整理並核對「目前 N 場開放」與每張場次卡。

workflow 會：

1. 將六個 checkbox 完整寫入 `docs/data/availability.json`。
2. 核對實際 JSON 與本次六個選項完全相同。
3. 檢查三梯六場、已取消內容、敏感檔案、HTML 與所有本機資產。
4. 有狀態變化時建立 `chore: update course availability` commit。
5. 不依賴下一次 push，在同一 workflow 直接部署通過驗證的版本。

## 常見狀況

### 勾錯場次

不必手動改 JSON。重新執行一次 **管理場次開放狀態**，勾選正確的完整六場狀態即可。每次 commit 都保留稽核紀錄。

### workflow 顯示紅色

先點進失敗步驟讀取錯誤：

- `Require the main branch`：重新執行並選 `main`。
- `Replace the complete six-session snapshot`：六個輸入不完整或資料契約已被破壞。
- `Validate selected state and public site`：課程筆數、取消詞、敏感檔或資產連結有問題；禁止略過驗證發布。
- `git push`：可能是 branch protection、Actions 權限或同時有人更新 `main`。由 repository 管理者確認後重跑。
- `Deploy`：確認 **Settings → Pages** 的 Source 已設為 **GitHub Actions**。

### 狀態沒變但仍重新部署

若六個 checkbox 與目前狀態相同，workflow 不建立空 commit，但仍會驗證並部署目前版本。這是正常行為。

## 權限與安全

- 不要把 GitHub token、Google token、密碼或會議密碼貼進 workflow 輸入。
- 不要在此 repo 上傳名單、報名表、簽到、回饋原始資料、簽名文件、預算、報價、合約或內部教材。
- 「尚未開放」只控制公開頁面的入口顯示，不是教材權限控管。
- 六場內容頁均已部署在公開 Pages；關閉場次不會刪除或保護其固定網址。
- 真正需要限制存取的教材，應留在機關核准且有身分驗證的系統；不得只靠隱藏 GitHub Pages 連結。

## 前測、後測與滿意度

- 每場前測只在上課前 30 分鐘至上課開始前開放。
- 每場後測只在下課前 10 分鐘至下課前開放，並在同次送出包含 5 題滿意度。
- 前測與後測使用兩份不同的 Google 表單；兩份表單都不收集 Email，並連到同一份私人 Google Sheets。
- 私人試算表分為「前測回覆」與「後測與滿意度回覆」，只有講師 Google 帳號可查看。
- 學員只在課程網站作答，不需開啟 Google 表單、不需 Google 或 GitHub 帳號。
- 公開頁面只能顯示「送出請求已完成」，不能直接讀取私人試算表確認入帳；只有講師確認未收到時，才請學員在當次開放時段內使用重送按鈕。
- 不要變更兩份 Google 表單唯一的「系統欄位」或刪除回覆試算表連結；如重新建立表單，必須同步更新 `docs/data/assessments.json` 的 action 與 fieldName。
- 時段控制依學員裝置時間呈現，只是填寫引導；不能視為身分驗證或防止繞過的安全機制。
