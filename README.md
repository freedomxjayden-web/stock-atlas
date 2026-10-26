# Stock Atlas · 股票知識地圖

繁體中文股票術語資料庫及港股／美股中長線研究網站。原生 JavaScript 前端部署於 GitHub Pages；Cloudflare Worker 取得公開價格及年度財務資料。

**網站：https://freedomxjayden-web.github.io/stock-atlas/**

## 已包含

- 200 個詳細術語，8 類各 25 個，附中英文、例子、公式（適用時）、注意事項、相關術語及延伸參考。
- 中英文／縮寫搜尋、分類與程度篩選、術語分享連結、本機收藏。
- 港美股價格圖表、均線、RSI、MACD、布林通道、量比、波動率及最大回撤。
- 年度營收、淨利、EPS、淨利率、增長及現金流；每項保留原始財報幣種。
- 透明的 100 分中長線觀察分，顯示缺漏項目、分數依據及資料覆蓋率。

## 本機啟動

需要 Node.js 22+（建議 24）及系統 `curl`。本機網站及分析測試毋須 npm 套件：

```sh
npm run check
npm run dev
```

打開 http://localhost:8787 。本機開發服務以 OS 信任憑證的 curl 連接上游；正式 Worker 使用原生 fetch。要測試 Worker 平台行為：

```sh
npm ci
npm run worker:dev
```

`site/config.js` 已指向正式 Worker。若要單獨測試本機資料轉接層，可暫時將 `API_BASE` 設為空字串，使用同源 `/api`；發佈時恢復正式網址。正式 Pages 在未設定 API 時會明確顯示尚未連接，術語及收藏繼續可用。

## 部署 Cloudflare Workers

```sh
npm ci
npx wrangler login
npm run deploy:worker
```

1. 在 `wrangler.jsonc` 的 `ALLOWED_ORIGINS` 放入自己的 GitHub Pages **origin**（例如 `https://yourname.github.io`，不含儲存庫路徑）。本機允許 localhost:8787。
2. 複製部署所得 `https://stock-atlas-api.<subdomain>.workers.dev` 公開網址，填入 `site/config.js` 的 `API_BASE`。
3. 可在 GitHub 儲存庫 Secrets 設定 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`，然後手動執行 Deploy Cloudflare Worker workflow。Token 需要相應帳戶的 Workers Scripts 編輯權限及部署所需讀取權限。不要把憑證放入網頁、程式碼或聊天。
4. 正式驗收：從 Pages 查詢 `700` 和 `AAPL`，確認 CORS、真實資料、時間戳及缺漏處理。健康檢查 `/api/health` 僅檢查服務在線，不能替代上游查詢驗收。

## 部署 GitHub Pages

將專案推送到公開 GitHub 儲存庫 main 分支。在 Settings → Pages → Source 選擇 **GitHub Actions**。附帶 workflow 先執行資料驗證與測試，再部署 `site/`。所有靜態資源使用相對路徑，頁面使用 `#/glossary` 等雜湊路由，支援專案子路徑。

## API

`GET /api/stock?symbol=700` 支援港股數字、`.HK`、美股代號及美股股本類別（如 `BRK.B` → `BRK-B`）。第一版限股票，不分析 ETF、指數或期貨。

回傳 `symbol, name, currency, exchange, marketTime, price, change, changePercent, bars, technical, fundamentals, score, source, cache, analyzedAt, warnings`。缺漏數值為 `null`；錯誤回傳 `{ "error": "繁體中文原因" }`。400：格式錯誤；403：來源不允許；404：不存在；429：限流；502：上游或格式錯誤。

報價快取 300 秒、年度財務 86400 秒。Worker 只允許固定 Yahoo Finance 上游，不是任意 URL 代理。CORS 只對允許的 origin 回覆，不代替身份驗證。每個 IP 在每個 Cloudflare 節點限制每分鐘 30 次；平台免費額度另受 Cloudflare 現行條款限制。

## 計算口徑

技術分析使用已完成交易日的供應商復權價格；沒有復權價格時回退原始收市價並提示。MA 使用簡單平均；RSI14 使用 Wilder 平滑；MACD12/26/9 的 EMA 以初始平均初始化；布林通道採 20 日總體標準差；60 日年化波動率採日對數回報樣本標準差 × √252；回撤期間為可用兩年。

評分：趨勢20、動能20、營收增長20、盈利20、現金流20。規則見網站分析方法。可用權重至少60、基本面可用權重至少20，才按 `實得分 / 可用權重 * 100` 換算。年度財報超過兩年不計分。不同財報日或幣種不混算；上年收入非正數不計一般增長率。

免費來源未提供可靠的同幣種估值倍數及 ADR 每股口徑，所以市盈率／市帳率明確顯示未提供，不自行猜測。這項觀察分並未按行業標準化，也並非回報預測。

## 驗證

`npm run check` 驗證 200 個術語的完整性與分類數量，並測試價格指標、Wilder RSI 參考值、評分門檻、財報過期與不同幣種、不完整交易日、CORS、錯誤代號及上游失敗。前端驗收記錄見 `VERIFICATION.md`。

## 資料限制

Yahoo Finance 公開介面並非附服務保證的授權即時行情服務，可能限制部分來源 IP、延遲、缺漏或變更格式。Cloudflare 正式來源須實際通過查詢驗收；若該環境被上游拒絕，應更換資料轉接層，不能把本機成功當作正式成功。網站不會顯示虛構報價。

術語按教學用途整理，附延伸參考；市場、稅務及產品條款以官方最新公布為準。收藏只存於目前瀏覽器，無帳戶或跨裝置同步。
