# CluBar 設計參考分析（依功能）

> 2026-11-27｜依據：[價值主張對齊](./00-value-proposition-alignment.md)、[UI 改善計畫](../../ui-redesign-plan.md)、[PRD v2](../../clubar-prd-v2.md)。
> 方法：四組研究並行，每個參考都以官方頁面、得獎紀錄或權威 UX 研究（NN/g、Baymard、W3C、Apple、Google）驗證；無法驗證的項目已標注 ⚠️，不作為規則依據。
> 用法：這份是**證據層**。真正約束開發的規則會整理進 `docs/design/` 的設計規範；本文件記錄每條規則「為什麼」。

---

## 0. 如何判斷參考夠不夠格

只採用符合下列任一條件的參考：

1. **有可信的獎項或編輯精選**：Apple Design Awards（分類含 Delight & Fun、Inclusivity、Interaction、Visuals）、Google Play 年度最佳、Webby（評分項含內容、結構導覽、視覺、功能、互動）、iF、Red Dot、**金點設計獎**（在地可信度）。Awwwards 偏展示型網站，實驗性版面不要照抄，尤其會犧牲中文可讀性的那種。
2. **它剛好解決我們要的那個模式**，且能從官方說明頁驗證。

選定後，用品牌五個形容詞（溫暖、有活力、歡迎新人、有質感、可信賴）逐一打分。NN/g 建議把**氛圍板**（只放視覺）和**模式板**（放截圖與流程）分開，不要混在一起。

來源：[ADA](https://developer.apple.com/design/awards/)｜[Webby 評分標準](https://www.webbyawards.com/judging-criteria/)｜[Awwwards 評分](https://www.awwwards.com/about-evaluation/)｜[金點](https://goldenpin.org.tw/en/participate/golden-pin-design-award)｜[NN/g Mood Boards](https://www.nngroup.com/articles/mood-boards/)｜[NN/g Brand Terms](https://www.nngroup.com/articles/ux-brand-terms-defined/)｜[NN/g Testing Visual Design](https://www.nngroup.com/articles/testing-visual-design/)

---

## 1. 品牌氛圍：溫暖但不像酒館廣告

| 參考 | 學什麼 | 不學什麼 |
| :--- | :--- | :--- |
| **Airbnb 2025 改版**（[It's Nice That](https://www.itsnicethat.com/articles/airbnb-app-redesign-140525)） | 溫暖感來自圓角、柔和動態、手作圖示，而不是高飽和色 | 珊瑚紅、3D 圖示、Cereal 字體（都是 Airbnb 的識別） |
| **Blue Bottle Coffee**（[Work & Co](https://work.co/news/blue-bottle-launches-new-mobile-app)） | 克制：一個小標誌、一個強調色，溫度交給照片 | 冷藍色；精品零售式的極度留白（社團列表需要資訊密度） |
| **Are.na**（[官方](https://www.are.na/editorial/introducing-areal-are-nas-new-typeface)） | 介面退到背景；沒有廣告、熱門榜、互動數字——「像圖書館，不像賭場」 | 粗獷冷調，缺乏溫度 |
| **Partiful**（Google Play 2024 年度最佳 App，[TechCrunch](https://techcrunch.com/2024/11/18/partiful-is-googles-best-app-of-2024/)） | 活動頁可以有個性；文案輕鬆幽默 | 霓虹派對風——這正是「夜店感」 |
| **Pinkoi 品牌更新**（台灣，[官方說明](https://medium.com/pinkoi-product/after-0-to-1-pinkois-brand-refresh-2a3961a8804a)） | 把粉紅換成海軍藍，因為顏色會**縮小受眾**；字標改得更易讀 | — |
| **好樣劇場咖啡 VVG**（台中，[Behance](https://www.behance.net/gallery/124872971/VVG-THEATER-CAFE-BRAND-IDENTITY)） | 黑灰白為底，個性交給線條插畫——和我們的 Logo 同路 | ⚠️ 未查到獎項 |
| **Untappd**（[官方](https://lounge.untappd.com/everything-you-need-to-know-about-untappd-badges/)） | **反面教材** | 飲酒打卡徽章、遊戲化——全部不要 |

**結論**：
- 強調色選**琥珀**，不選酒紅。Pinkoi 的經驗說明顏色會縮小受眾，而酒紅會被讀成「酒」。→ 三個原型中淘汰 **B**，在 **A（宋體）／C（粉圓）** 之間選。
- 插圖與圖示**只用人、桌子、杯墊、咖啡杯、票根**，酒杯只留在 Logo 本身。

---

## 2. 探索首頁（別的聚）：搜尋、篩選、瀑布流

| 參考 | UI 模式 | UX 模式 | 不學 | 對應 |
| :--- | :--- | :--- | :--- | :--- |
| **Pinterest** | 保留原圖比例的瀑布流（W3C masonry 規格就拿它當範例，[explainer](https://github.com/w3c/csswg-drafts/blob/master/css-grid-2/MASONRY-EXPLAINER.md)） | 卡片只是預覽，細節在詳情頁 | 收藏數、推廣內容、無限互動流 | `DiscoverClient` 社團現場 |
| **小紅書** | 手機雙欄瀑布、窄邊距、封面＋標題＋作者列 | 搜尋提示用「關鍵詞組合」（例如「零基礎＋攝影」） | 每張卡的按讚數、紅色熱門標 | `PostCard`、搜尋提示 |
| **Airbnb 類別列**（[2022](https://news.airbnb.com/2022-summer-release/)） | 圖示＋文字的類別列放在結果上方 | 用類別探索「不知道要搜什麼」的東西 | 56 個類別 → 我們維持 6 大領域 | 領域 chips |
| **Cosmos.so**（[宣言](https://www.cosmos.so/manifesto)） | 內容優先的網格 | 「沒有按讚、留言、自我」；詳情頁推「相似內容」 | 冷黑白配色 | 排序原則、詳情頁的相似社團 |
| **Luma 行事曆**（[說明](https://help.luma.com/t/calendars)） | 依日期排列的活動列表、可依標籤篩選 | — | 倒數計時、製造急迫感 | 近期活動分頁 |

權威依據：[Baymard：已套用篩選總覽](https://baymard.com/blog/how-to-design-applied-filters)｜[NN/g 分頁](https://www.nngroup.com/articles/tabs-used-right/)｜[NN/g 搜尋建議](https://www.nngroup.com/articles/site-search-suggestions/)｜[NN/g 卡片](https://www.nngroup.com/articles/cards-component/)｜[NN/g 社會認同](https://www.nngroup.com/articles/social-proof-ux/)（小數字會反效果，暗示「很少人認同」，而小社團的數字通常都小）

---

## 3. 社團主頁（我的聚・對外門面）與追蹤

| 參考 | UI 模式 | UX 模式 | 不學 | 對應 |
| :--- | :--- | :--- | :--- | :--- |
| **Discord 伺服器探索**（[說明](https://support.discord.com/hc/en-us/articles/360023968311)） | 橫幅＋名稱＋一句介紹＋認證徽章 | 決定加入前先讀「關於」 | 線上人數、依人數排序 | 社團頁首、認證徽章 |
| **Strava Clubs**（[說明](https://support.strava.com/hc/en-us/articles/216918347-Clubs-on-Strava)） | 清楚的加入按鈕＋「審核中」狀態 | 外人看得到社團，社員限定內容隱藏 | **每週排行榜**、成員總數 | 頁首主要按鈕；公開／社員內容分層 |
| **Luma 行事曆頁**（[iCal](https://help.luma.com/p/ical-syncing)） | 訂閱按鈕＋iCal 訂閱 | 一次訂閱，網頁與 App 同步 | 訂閱人數 | 追蹤按鈕（資料模型已有「全部／只看活動」） |
| **Letterboxd**（Webby 2024 人氣獎，[得獎頁](https://winners.webbyawards.com/2024/apps-software/general-apps/entertainment-sports/298431/letterboxd)） | 頁面上方釘選幾件「代表作」 | 由擁有者決定先展示什麼 | 追蹤數、評論數；⚠️ 四部最愛的細節未驗證 | 作品牆釘選 3–4 件代表作 |

---

## 4. 活動頁、報名與分享

| 參考 | UI 模式 | UX 模式 | 不學 | 對應 |
| :--- | :--- | :--- | :--- | :--- |
| **Partiful「找時間」**（[說明](https://help.partiful.com/hc/en-us/articles/24495283288987)） | 投票放在日期欄位裡，每個時段可回答可以／不行／也許 | 主辦鎖定時間後，**投票自動轉成報名**，不必再報一次 | Emoji 報名、Boops、派對數據回顧（像計分板） | 時間待定＋投票、主辦「鎖定時間」 |
| **Luma 來賓名單**（[說明](https://help.luma.com/p/event-guest-list.md)） | 顯示幾個頭像與名字；主辦可整份隱藏 | 確認信附 .ics；可訂閱「我報名的全部活動」 | **公開人數** → 學頭像，不學數字 | 參加者頭像列、加入行事曆 |
| **Apple Invites**（[Newsroom 2025-02](https://www.apple.com/newsroom/2025/02/introducing-apple-invites-a-new-app-that-brings-people-together/)） | 每個活動一本共享相簿 | **不用帳號就能在網頁回覆**；主辦決定連結預覽顯示哪些資訊；每位來賓決定自己怎麼被看見 | 付費才能主辦、AI 生成背景（模板感） | 活動後相簿、分享預覽設定、公開／匿名切換 |
| **Baymard 確認頁研究**（[文章](https://baymard.com/blog/order-confirmation-page)） | — | 確認頁一定要有摘要、關鍵日期、「確認信已寄出」 | — | 「位子幫你留好了」確認狀態 |

---

## 5. 主辦端：建立活動與宣傳

| 參考 | 模式 | 不學 | 對應 |
| :--- | :--- | :--- | :--- |
| **Apple 視覺智慧：海報轉活動**（[Newsroom](https://www.apple.com/newsroom/2025/06/apple-intelligence-gets-even-more-powerful-with-new-capabilities-across-apple-devices/)） | 讀海報、填入日期地點，使用者確認；評測指出皺褶或特殊字體會讀錯 | 不經確認直接存進行事曆 | AI 海報草稿 |
| **Luma 建立活動**（[說明](https://help.luma.com/p/creating-an-event)） | 一張短表單＋即時預覽；票種、審核等進階設定延後 | 40 多種主題（模板感） | 4 段式建立表單 |
| **Eventbrite AI＋社群分享**（[說明](https://www.eventbrite.com/blog/share-on-social/)） | AI 擬摘要；分享前可編輯各平台貼文 | AI 圖庫照片 | 宣傳包（IG／LINE／Discord 各自可編輯） |
| **Meetup AI 描述**（[說明](https://help.meetup.com/hc/en-us/articles/39790436736525)） | 官方建議修改 AI 文案，讓它像人寫的 | — | AI 描述欄位提示「加一句你自己的話」 |
| **Posh**（[App Store](https://apps.apple.com/us/app/-/id1556928106)） | **反面教材**：付費推廣人、分潤追蹤是夜店行銷手法 | 全部 | — |

權威依據：[NN/g 表單設計](https://www.nngroup.com/articles/web-form-design/)｜[NN/g 精靈式流程](https://www.nngroup.com/articles/wizards/)

---

## 6. 新手引導與 Blend 分享卡

| 參考 | 模式 | 不學 | 對應 |
| :--- | :--- | :--- | :--- |
| **Duolingo 延後註冊**（[First Round](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker)） | 一頁一題、大按鈕、細進度條；先給價值，再用可跳過的軟性提示請註冊。⚠️ +20% DAU 是訪談數字 | 連勝壓力、罪惡感通知、經驗值 | `/onboarding` |
| **Spotify Blend**（[Newsroom](https://newsroom.spotify.com/tag/spotify-blend)） | 限動格式分享卡；連結邀請，對方接受後自動生成共同結果 | **契合度百分比**：社群回報同一對人分數忽高忽低（[討論串](https://community.spotify.com/t5/Content-Questions/My-taste-match-percentages-in-my-blends-recently-dropped/m-p/6281660)），而且像在評分友情 | Blend 卡：「你們共同的 3 個興趣＋1 個推薦社團」 |
| **NN/g 行動版引導**（[文章](https://www.nngroup.com/articles/mobile-app-onboarding/)） | 只問會改變內容的問題、說明為什麼問、「跳過」要明顯；不做翻卡式教學 | — | 測驗開場文案與跳過連結 |

---

## 7. 個人課外足跡（/me、/u/handle）

| 參考 | 模式 | 不學 | 對應 |
| :--- | :--- | :--- | :--- |
| **Letterboxd 日記／年度回顧**（[2024](https://letterboxd.com/2024/)） | 日記列表（日期＋項目＋短記）；統計從日記長出來 | 星等評分、公開數字 | 「社團日記」時間軸 |
| **GitHub 貢獻圖**（[文件](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/showing-your-private-contributions-and-achievements-on-your-profile)） | 安靜的熱度格；擁有者控制可見度 | 連續天數、成就徽章 | 學期足跡格 |
| **Strava 隱私**（[說明](https://www.androidcentral.com/apps-software/how-to-control-your-privacy-settings-strava)） | 每一筆可設「所有人／追蹤者／僅自己」；可批次修改過去紀錄 | 排行榜、kudos | 每筆足跡的可見度：公開／社員／僅自己 |
| Read.cv | ⚠️ 2025-05 已停止服務（[TechCrunch](https://techcrunch.com/2025/01/17/perplexity-acquires-read-cv-a-social-media-platform-for-professionals/)），只作排版氛圍參考 | — | — |

---

## 8. 一起聚：跨校交流

| 參考 | 模式 | 對應 |
| :--- | :--- | :--- |
| **itch.io Jams**（[文件](https://itch.io/docs/creators/game-jams)） | 主題＋起訖時間＋作品牆；官方提醒「開放公眾投票通常是壞主意」 | 跨校共作企劃卡：主題、截止日、作品牆；不做公開投票 |
| **Dribbble Rebound**（[說明](https://help.dribbble.com/en/articles/11062648-rebounds)） | 回應作品連回原作，形成接力鏈 | 接力回應：顯示來源與接力鏈 |
| **Figma Community**（[說明](https://help.figma.com/hc/en-us/articles/360042296374)） | 複製是獨立副本；Remix 保留出處（CC BY 4.0） | 共享資源「複製這份範本」必須標註來源社團 |
| **Hugging Face Spaces**（[文件](https://huggingface.co/docs/hub/en/spaces-overview)） | 複製時選擁有者與可見度，預設私人 | 把活動企劃包複製到自己社團，發布前不公開 |
| **ADPList**（[官網](https://adplist.org/find-a-mentor)） | 導師卡：背景、可約時段 | 校友請益卡（不顯示評分） |
| **Product Hunt**（[公告](https://www.producthunt.com/p/producthunt/rip-golden-kitty-awards-long-live-orbit-awards)） | 停辦按讚票選獎，改成上線後的長期獎項：「真正的故事在上線之後」 | 不用按讚排行榜組織版面 |

---

## 9. 系統回饋：空狀態、載入、錯誤、確認、動態

| 來源 | 規則 |
| :--- | :--- |
| [NN/g 空狀態](https://www.nngroup.com/articles/empty-state-interface-design/) | 說明現在是什麼狀態（載入中、沒結果、出錯）、在情境裡教學、給一個直接的下一步 |
| [NN/g 骨架屏](https://www.nngroup.com/articles/skeleton-screens/) | 1 秒內不顯示載入；2–10 秒整頁用骨架、單一區塊用轉圈；超過 10 秒用進度條；骨架要對應真實版面 |
| [NN/g 錯誤訊息](https://www.nngroup.com/articles/error-message-guidelines/) | 放在出錯欄位旁、不只靠顏色、白話、說明怎麼做、**保留使用者輸入**、不責怪 |
| [NN/g 確認對話框](https://www.nngroup.com/articles/confirmation-dialog/) | 只確認不可逆的操作、寫出操作對象、按鈕用「動詞＋對象」、不預選；能用「復原」就不用確認框 |
| [WCAG 2.3.3 ＋ C39](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | 互動觸發的動態必須能關閉（`prefers-reduced-motion`） |
| ⚠️ Material 3 Snackbar、Apple HIG Alerts | 頁面未成功讀取，未作為依據 |

---

## 10. 整併後的設計規則（候選，待寫入設計規範）

**品牌與視覺**
1. 只有一個強調色，用**琥珀**；除了底色與墨色，每個畫面最多一個高飽和色相。
2. Logo 以外不出現酒類意象；插圖只用人、桌子、杯墊、咖啡杯、票根。
3. 溫度來自字體、圓角、動態與照片，不靠加裝飾；資訊必須在不捲動、不 hover 的情況下看得到。

**內容與公平（價值主張）**
4. 介面上不出現個人或社團的人氣數字：按讚、追蹤、人數、排名、契合度百分比都不行。**非競爭性的集體累計**（例如「本學期社員共同累積的足跡」）可以保留——PRD §1.2 明文允許。
5. 只用質性信任訊號：近 30 天活躍、零基礎可、非社員可、問答有回覆。
6. 圖片不裁切：顯示比例與原圖比例一致；不在固定高度的框裡用 `object-cover`。
7. 一張卡只有一個入口：圖、標題、一行資訊、最多 2 個信任標籤，整張卡連到詳情。
8. 探索流有盡頭：看完要明確提示，並提供其他主題入口。
9. 接力回應與複製的資源，一律顯示來源與來源社團。

**流程與回饋**
10. 新手測驗不用登入；結果出來後才以可跳過的方式請註冊，跳過時結果仍要保留。
11. 時間投票鎖定後自動轉成報名；報名確認一定顯示活動名稱、時間（或「待定、投票中」）、地點、確認已寄出。
12. AI 只產生草稿，不直接發布；AI 填入的欄位要標示「請確認」。
13. 能復原的操作用「復原」提示；只有不可逆的操作才跳確認框，按鈕寫「動詞＋對象」。
14. 每個空狀態都有 1 張插圖、1 句說明、1 個主要行動。
15. 載入顯示遵循 NN/g 的時間門檻；表單出錯時不清空使用者的輸入。
16. 慶祝動態 200–400ms；開啟減少動態時只保留透明度變化，或完全不動。

---

## 11. 研究發現的 UX 改進待辦

| # | 頁面 | 改進 | 依據 |
| :--- | :--- | :--- | :--- |
| U-01 | 社團頁 | 作品牆和封面圖目前會裁切（`clubs/[slug]/page.tsx` 用 `object-cover`），改成和探索流相同的瀑布流、封面不裁切 | 規則 6 |
| U-02 | 社團頁 | 頁首下方加一列信任標籤（近 30 天活躍、零基礎可、非社員可、問答回覆）；目前只有認證社團顯示 | Discord、規則 5 |
| U-03 | 社團頁 | 2–3 則置頂 FAQ 移到作品牆上方，或在頁首放錨點連結 | 新手需求 |
| U-04 | 社團頁 | 追蹤改成明確二選一：「全部動態／只看活動」；活動卡提供加入行事曆 | Luma |
| U-05 | 社團頁 | 釘選 3–4 件代表作品 | Letterboxd |
| U-06 | 探索首頁 | 有篩選條件時，在結果上方列出已套用的條件，每個可單獨移除，並有「清除全部」（需先確認現況是否已部分做到） | Baymard |
| U-07 | 活動頁 | 確認狀態補齊四要素；參加者只顯示頭像、不顯示人數；報名時就能切換公開／匿名 | Baymard、Luma、Apple Invites |
| U-08 | 活動頁 | 活動結束後，報名區轉成「上傳照片」（限參加者） | Apple Invites |
| U-09 | 活動頁 | 主辦可控制分享預覽隱藏哪些欄位；OG 圖使用票根樣式 | Apple Invites |
| U-10 | 活動／社團 | 社團行事曆訂閱（.ics feed），個人 feed 包含待確認的報名 | Luma |
| U-11 | 建立活動 | AI 填入的欄位標示「請確認」；日期與地點沒確認前不能發布 | Apple、Meetup |
| U-12 | 宣傳包 | IG／LINE／Discord 文案各自可編輯，以社團自己的海報為主 | Eventbrite |
| U-13 | Blend | 拿掉分數，改成「共同的 3 個興趣＋1 個推薦社團」 | Spotify 反例 |
| U-14 | 個人足跡 | 每筆足跡可設公開／社員／僅自己，並可批次修改 | Strava、GitHub |
| U-15 | 通知 | 依社團／活動分組；全部看完時推薦一個近期活動 | NN/g 空狀態 |
| U-16 | 全站表單 | 驗證或網路錯誤時不清空輸入，錯誤顯示在欄位旁 | NN/g |

### 不採用的建議

- **拿掉社團頁「本學期共同累積 N 則社員日常足跡」**：研究組認為這是人氣數字，但 PRD §1.2 明文允許「非競爭性集體累計」，它也沒有拿來和其他社團比較。保留。
- **上線前找 5 位學生做偏好測試**：依 2026-11-27 的決策，暫不招募受測者，改由產品負責人用品牌形容詞表自評。
