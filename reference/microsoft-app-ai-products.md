# Microsoft 系列產品

### 微軟 App 開發與 AI 應用產品全覽表

| **分類** | **微軟產品名稱** | **主要用途（一句話掌握）** |
| --- | --- | --- |
| **前端 / 介面層**<br>*(使用者看到的門面)* | **Microsoft Power Apps** | **低程式碼（Low-Code）快速拉出手機/網頁 App 介面**，適合表單輸入、審核與功能操作。 |
|  | **Microsoft Teams** | **團隊通訊與聊天機器人入口**，讓使用者免安裝額外 App，直接在對話框與 AI 互動。 |
|  | **Microsoft Copilot Studio** | **專門設計對話型 AI Agent / Chatbot 的視覺化平台**，可直接發布至 Teams 或網站。 |
|  | **Power Pages** | **快速建立對外公開的網站入口（Portal）**，供校外人士或免登入大眾查詢使用。 |
|  | **.NET MAUI** *(專業開發)* | **跨平台原生 App 開發框架**，若需寫原生程式碼（iOS/Android/Windows 共用）時使用。 |
| **AI 與智慧運算**<br>*(核心大腦與檢索)* | **Azure AI Search** | **企業級語意/向量搜尋服務**，負責精準查找法規、公告與課綱，為 AI 提供可靠參考資料。 |
|  | **Azure OpenAI Service** | **提供 GPT-4o 等先進大語言模型**，負責閱讀檢索結果並生成自然口語的回覆。 |
|  | **Azure AI Services** | **現成 AI 認知套件**，支援語音辨識/合成（語音助理）、文件辨識（OCR）、影像分析等。 |
| **邏輯與流程自動化**<br>*(系統血管串聯)* | **Power Automate** | **無程式碼自動化工作流**，例如「收到提問 → 呼叫 AI → 發送通知 Email / Teams 訊息」。 |
|  | **Azure Functions** | **無伺服器（Serverless）後端小程式**，適合跑客製化的 Python/Node.js API 運算。 |
|  | **Azure App Service** | **雲端應用程式託管服務**，用來架設傳統的 Web API 或後端伺服器。 |
| **資料庫與檔案儲存**<br>*(記憶體與知識庫)* | **Microsoft Dataverse** | **Power Platform 內建的安全雲端關聯資料庫**，適合存放表單資料、權限設定與業務數據。 |
|  | **Azure Blob Storage** | **海量非結構化檔案儲存**，用來存放 PDF、規章文件、圖片等供 AI Search 建立索引的原始檔。 |
|  | **Azure SQL Database** | **標準雲端關聯式資料庫**，適合存放傳統結構化業務資料。 |
| **身分驗證與管理**<br>*(安全與門禁)* | **Microsoft Entra ID**<br>*(原 Azure AD)* | **身分驗證與單一登入（SSO）**，用校園微軟學生帳號直接登入，並區分學生與教師權限。 |
| **數據分析與呈現**<br>*(成果指標與儀表板)* | **Power BI** | **視覺化圖表與儀表板**，可在 App 內呈現系統使用成效、提問趨勢或校園滿意度統計。 |

### 針對競賽的「黃金搭配組合」建議（最省時、最吸睛）：

如果是在參賽提案中做 Demo 或概念架構，最推薦以下兩條搭配路線：

1. **聊天助理型（最快落地）：**
    - **前端入口**：Microsoft Teams / Copilot Studio
    - **AI 大腦**：Azure AI Search（搜知識庫） + Azure OpenAI（生成回答）
    - **資料來源**：Azure Blob Storage（存 PDF 公告/章程）
2. **流程/表單系統型（功能最豐富）：**
    - **前端介面**：Power Apps（手機介面，附功能按鈕與選單）
    - **自動化橋樑**：Power Automate（串接前端與後端）
    - **AI 搜尋**：Azure AI Search
    - **後台報表**：Power BI（向評審展示管理員視角的數據儀表板）
