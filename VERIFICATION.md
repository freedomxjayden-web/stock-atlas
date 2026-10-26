# 驗收記錄

日期：2026-10-26（Asia/Macau）。

## 自動檢查

`npm run check` 通過：200 個唯一術語、8 類各 25 個，必要欄位、程度、參考來源及相關術語 ID 完整；14 個 Node 測試全數通過。

涵蓋代號正規化、SMA／EMA／Wilder RSI／MACD／布林通道、60 日年化波動率與最大回撤、歷史不足、年度財報幣種與期間、過期及未來財報、評分門檻、缺漏權重、香港與美國時區、盤中排除、CORS、限流及上游錯誤。

`wrangler deploy --dry-run` 通過，正式 Worker 已部署。日期格式器重用以減少免費 Worker CPU 用量。

## 瀏覽器操作

Playwright CLI，Chromium，1440×1000 桌面及 390×844 手機尺寸。15 項檢查通過：

1. 中文術語搜尋。
2. 術語詳情、公式及分享路由。
3. Escape 關閉詳情。
4. 收藏與重新整理持久化。
5. 港股真實分析。
6. 圖表期間切換。
7. MA20／MA200／布林通道展開。
8. 分析指標連到術語並返回。
9. 無效股票代號錯誤。
10. 美股真實分析。
11. 快速切換股票不顯示舊回應。
12. 手機版沒有橫向溢出。
13. 手機選單關閉時不可聚焦隱藏連結。
14. 手機導覽與收藏股票。
15. 無 JavaScript pageerror。

測試無效代號時，預期可見 HTTP 400；這不是 JavaScript 執行錯誤。頁面符合 reduced-motion 設定，快照亦停用過場動畫避免截到移動中的選單。

## 正式服務

- GitHub Pages：https://freedomxjayden-web.github.io/stock-atlas/
- Cloudflare Worker：https://stock-atlas-api.stock-atlas.workers.dev
- 由正式 Worker 搭配 Pages Origin 成功查詢 `700` 及 `AAPL`，兩者均取得價格、年度財報與 100% 評分覆蓋率。
- 同時驗證 `NVDA` 真實資料；未使用示範報價或硬編碼分析數字。
- GitHub Pages 部署 workflow 已成功執行，公開首頁 HTTP 200。
- 跨幣種港股財報保留 CNY，報價保留 HKD，未自行推算市盈率。

## 實際限制

- Yahoo Finance 公開介面可變更或限流；不是有服務保證的授權即時行情。
- 第一版只分析股票，不支援 ETF、指數、期貨。
- 市盈率與市帳率因缺乏可核實的統一口徑而明確顯示未提供。
- 收藏為瀏覽器本機資料，沒有登入及跨裝置同步。
- Worker 首次部署已使用 OAuth；若要在 GitHub Actions 自動部署 Worker，擁有者仍需設定 `CLOUDFLARE_API_TOKEN` 與 `CLOUDFLARE_ACCOUNT_ID` Secrets。Pages 已可自動部署。
- 八個主要延伸參考來源中，五個回應 HTTP 200；Investor.gov 兩項及 SEC 回應 HTTP 403（網站存取限制），因此未聲稱逐項核實這些外部頁面的全文。
