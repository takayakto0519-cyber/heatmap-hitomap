# ヒトマップ・オフィス（agent-dashboard）

「ヒトマップビル」を2026-07-18にAgentRoom風の見える化へ刷新したもの。ローカルPythonサーバー1本で完結し、追加課金なし。

## 開き方
- デスクトップの **`ヒトマップビル.bat`**（`C:\Users\takaya\OneDrive - 東京農業大学\デスクトップ\ヒトマップビル.bat`）をダブルクリック
- または `start.bat` をこのフォルダから実行
- または `python server.py` → `http://127.0.0.1:8765`

## このフォルダの中身
| ファイル | 役割 |
|---|---|
| `server.py` | ローカルAPIサーバー本体。エージェント一覧・パイプライン・編集APIを提供 |
| `index.html` | AgentRoom風オフィスUI（1ファイル完結） |
| `agent_config.json` | UIから編集したエージェントの表示上書き（名前・絵文字・メモ）。自動生成・自動更新 |
| `start.bat` | このフォルダから起動する用（デスクトップの`ヒトマップビル.bat`と同内容） |

## 画面の見方
- **いま働いている部屋（LIVE）**：最上部。稼働中のエージェントだけが大きなキャラで集まる。赤いランプが点滅
- **各フロア**：部署ごとの部屋。デスクにキャラが座り、稼働中はぴょこぴょこ動く＋✨、休憩中は💤
- **左サイドバー**：部署別一覧・検索・折りたたみ
- **統計バー**：稼働/休憩/未着工の数、今月のMVP（👑）
- **下部カード**：案件パイプライン（`04_人事クライアント管理_HR_Client/案件/`）／収益化イニシアチブ／今日のオフィス日報

## キャラをクリックすると
- 詳細（今何をしているか・自動実行スケジュール・生データ）
- ▶ 今すぐ動かす（手動実行）
- ✏️ 編集タブ：表示名・絵文字・メモ・スケジュール表示を書き換えて保存

## ヘッダーの「⚙ データ編集」
以下のデータファイルをUIから直接編集できる（ホワイトリスト方式）：
- 収益化イニシアチブ（`01_経営幹部_Executive/収益化イニシアチブ.md`）
- 学生課題の締切（`学生課題/締切.md`）
- LINE縁ミッション設定（`agents/line_bot/config.json`）
- 営業メール ターゲット／文面テンプレート（`営業メール/`）

## 動いているエージェント一覧（2026-07-18時点・全19体）

Windowsタスクスケジューラに登録済み。API不要・ルールベースの読み取り専用（LLMを呼ばない）。実行のたびに`agents/work/xp.json`へ経験値が貯まりレベルアップする。

| # | 名前 | フロア | スケジュール |
|---|---|---|---|
| 3 | 06番地滞留監視 🐹 | A 組織運営 | 毎日08:00 |
| 4 | リード温度感スコアリング 🐧 | B マーケ営業 | 毎日08:45 |
| 6 | 入金照合番人 🐮 | H 財務 | 毎日08:50 |
| 8 | 案件パイプライン番人 🐿️ | B マーケ営業 | 毎日08:15 |
| 10 | 失注理由アーカイブ 🐋 | B マーケ営業 | 毎週月09:00 |
| 19 | 通報一次スクリーニング 🦫 | D プロダクト | 毎日07:30 |
| 22 | データ整合性夜間QA 🦔 | D プロダクト | 毎日02:00 |
| 23 | 不正投稿検知 🐝 | D プロダクト | 毎日03:00 |
| 25 | スケジュール番人 🐈 | A 組織運営 | 毎日07:15 |
| 27 | 燃え尽き検知番人 🐨 | A 組織運営 | 毎日21:00 |
| 42 | 財務・事業ダッシュボード要約 🐷 | H 財務 | 毎日07:45 |
| 54 | 課題締切トラッキング 🐰 | K 学生課題 | 毎日07:00 |
| 60 | 今日のニュース抽出 🐦 | B マーケ営業 | 8時間ごと |
| 62 | 痕跡データパターン分析 🦩 | I データR&D | 毎日02:30 |
| 63 | 関係人口ダッシュボード 🦚 | G 自治体B2G | 毎日02:40 |
| 101 | ビル日報AI 🐤 | A 組織運営 | 毎日09:15 |
| — | 収益化イニシアチブ番人 🐸 | J 新規事業 | 毎日08:30 |
| — | LINE縁ミッション生成 🐇 | E コミュニティ | 毎日確認（2週に1度発火） |
| — | 営業メール下書きキュー 🐢 | B マーケ営業 | 毎日08:35 |

登録・更新は `agents/register_tasks.ps1` を実行（`cd agents; powershell -ExecutionPolicy Bypass -File register_tasks.ps1`）。

## 思考が要るエージェント＝Claude Codeスキル（`.claude/skills/`、全102体・2026-07-18時点）

会長がチャットで「◯◯して」と話しかけると動く。番人と違い、都度の判断や文章生成が要るもの。105体ロードマップのうち番人化した15体・101〜105を除く、ほぼ全項目がここに揃った。

**① 営業クロージング（1-12・全12）**
`quote-draft`(1見積) `meeting-prep`(2商談準備) `meeting-followup`(3商談後整理) `invoice-draft`(5請求書) `contract-check`(7契約チェック) `card-followup`(8名刺フォロー) `pitch-diff`(9ピッチ差分) `referral-request`(11紹介依頼) `appointment-helper`(12アポ調整)
※4,6,10,25,27は番人（Python）化済み

**② 顧問業の納品力（13-27・全15）**
`client-dossier`(13) `monthly-report`(14) `ai-policy-template`(15) `work-audit`(16) `effect-measure`(17) `subsidy-scan`(18) `subsidy-application`(19) `client-news`(20) `company-profiling`(21) `training-builder`(22) `faq-vault`(23) `minutes-summary`(24) `secretary`(26)

**③ ストック商品化 A-1/A-3系（28-42・全15）**
`kit-assembler`(28) `skill-packager`(29) `skill-doc-writer`(30) `market-price-scan`(31) `listing-status-check`(32・2026-07-18追加) `review-reply`(33) `kit-landing-page`(34) `kit-update-watch`(35・追加) `x-note-draft`(36) `case-study-page`(37) `global-market-research`(38) `new-biz-hypothesis`(39) `competitor-market-research`(40・追加) `free-diagnosis-content`(41) `competitor-feature-monitor`(42・追加)

**④ 教える型・研修/採用インターン（43-55・全13）**
`training-signup`(43) `training-survey-analysis`(44) `attendee-followup`(45) `recruit-video-outline`(46) `staff-trading-card`(47) `intern-matching`(48) `intern-phase-tracker`(49) `trace-reading-training`(50) `alumni-network`(51) `speaking-kit`(52) `resonance-analysis`(53) `trace-story`(54) `media-mention-monitor`(55)

**⑤ B-3マイクロSaaS種まき（56-70・14中12）**
`saas-demand-validation`(56) `waitlist-landing`(57) `mvp-spec`(58) `user-interview-analysis`(59) `saas-price-monitor`(60) `churn-analysis`(61) `gov-proposal-custom`(64) `furusato-nozei`(65) `region-feature-page`(66) `migration-funnel`(67) `academic-partnership-research`(70・追加)
※62,63は番人化済み／68,69は原メモで優先度低と明記し未着手のまま

**⑥ 守り・プロダクト運用（71-84・全14）** — 2026-07-18追加
`sponsor-triage`(71) `event-prelaunch-check`(72) `onboarding-dropoff-analysis`(73) `host-companion`(74) `participant-resonance-matching`(75) `community-health-watch`(76) `suijo-cycle-visualize`(77) `churn-signal-detect`(78) `ab-test-summary`(79) `command-center`(80) `backup-watch`(81) `pii-audit`(82) `sla-watch`(83)
※84 意思決定ログ検索は既存の`decision-log`が兼ねる

**⑦ 財務計器盤（85-94・9中8）** — 2026-07-18追加
`biz-line-pnl`(85) `time-value-analysis`(86) `deal-profitability-tracker`(87) `cashflow-forecast`(89) `tax-memo`(90) `weekly-self-improve`(93) `dashboard-usage-watch`(94)
※88投資リターン追跡は別リポジトリ(moomoo)の管轄のため対象外／91海外展開リサーチは38と統合

**⑧ 学生・卒論支援（95-100・全6）** — 2026-07-18追加
`lit-review-collect`(95文献収集) `citation-formatter`(96参考文献) `lecture-note-organizer`(97講義ノート) `report-outline`(98レポート骨子) `seminar-progress-tracker`(99ゼミ進捗) `thesis-data-extract`(100研究データ抽出)

**営業メール**
`sales-email`（抽出→下書き。**送信は自動化していない**。会長が確認して送る）

**Claude Codeマスター推奨・汎用開発スキル** — 2026-07-18追加
`systematic-debugging`（体系的デバッグ4ステップ／Superpowers由来） `brainstorming`（実装前の構造化ブレスト／Superpowers由来） `changelog-writer`（変更履歴生成） `pr-description-writer`（PR説明文生成）
※pdf/docx/pptx/xlsx/code-review/security-review/skill-creatorは`anthropic-skills`プラグインとして別途利用可能（重複実装せず）

**ヒトマップ既存（今回より前から）**
`achievement-blog` `agent-status` `approval-sweep` `biz-memo` `case-pipeline` `decision-log` `instagram-post` `lead-scout` `thesis` `weekly-review`

## LINE縁ミッション（`agents/line_bot/`）
75人グループを「縁を設計する装置」にする仕組み。詳細は `agents/line_bot/README.md`。
**現状：コードは完成、稼働にはトークン・group_id・公開webhook URLの設定が要る（会長作業）。**

## 営業メール（`営業メール/`）
`targets.json`（送り先）＋`template.md`（文面）を`email_queue.py`が読み、06番地に下書きを積む。**自動送信はしない**（憲法・安全規則）。

## 設計原則（変更時に守ること）
1. 番人（Python）はAPI/LLMを呼ばず、ローカルファイルかSupabase REST読み取りのみ
2. 外部送信（メール・LINE投稿・SNS投稿）は既定で行わない。下書きは`06_実行待機_Approval`か番人のwork/に置き、会長が最終実行する
3. 新しいエージェントを追加したら：①`agents/*.py`か`.claude/skills/*/SKILL.md`を書く ②`server.py`の`LOCAL_AGENTS`と`_summarize_local_result`に登録 ③（番人なら）`register_tasks.ps1`に追記して再実行 ④未着工リスト`VACANT_AGENTS`から該当項目を除去
5. 収益化ロードマップの正本は `01_経営幹部_Executive/戦略メモ_エージェント105実装ロードマップ_20260718.md`
