# swallow-archive

春燕來了每日盤勢摘要的歷史歸檔。Next.js 16 app router + 密碼保護 + 自動部署到 Vercel。

## 本機開發

```bash
cp .env.example .env.local
# 編輯 .env.local 設定 ARCHIVE_PASSWORD

npm install
npm run dev
# 開 http://localhost:3000
```

## 內容如何上線

報告由 `mediapost-test\publish.ps1` 推上來。流程：

```
mediapost-test\share\<YYYYMMDD>_<HHMM>_result.md
    → publish.ps1 copy → swallow-archive\public\data\reports\<date>.md (+ .json)
    → build_index.py 重建 public\data\reports.json
    → 顯示 git diff 給你看
    → 你按 y → git push
    → GitHub 觸發 Vercel auto-deploy
```

## 結構

```
app/
├── layout.tsx
├── page.tsx                  # 著陸頁
├── login/                    # 密碼登入
│   ├── page.tsx
│   └── actions.ts
├── reports/[date]/page.tsx   # 個別報告
├── lib/reports.ts            # 讀 public/data 的 helper
└── globals.css

proxy.ts                      # Next.js 16 把 middleware 改名 proxy
                              # 攔截所有非 /login 路徑、檢查 cookie

public/data/                  # 由 publish.ps1 寫入
├── reports.json              # manifest
└── reports/
    ├── <date>.md
    └── <date>.json
```
