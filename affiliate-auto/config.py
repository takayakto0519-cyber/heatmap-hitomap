"""設定ファイル"""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

# ─── Claude API ──────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL      = "claude-haiku-4-5-20251001"  # 速度・コスト重視; 品質優先は claude-sonnet-5

# ─── note.com ────────────────────────────────────────────
NOTE_EMAIL    = os.getenv("NOTE_EMAIL", "hitomap.info@gmail.com")
NOTE_PASSWORD = os.getenv("NOTE_PASSWORD", "")
DRAFT_ONLY    = True  # True=下書き保存, False=即公開

# ─── Amazon ──────────────────────────────────────────────
AMAZON_ASSOCIATE_TAG = os.getenv("AMAZON_ASSOCIATE_TAG", "")
AMAZON_BASE_URL      = "https://www.amazon.co.jp"

# ─── RSS フィード一覧 ─────────────────────────────────────
RSS_FEEDS = [
    # テック・ガジェット
    "https://www.itmedia.co.jp/rss/2.0/news/bursts/rss.xml",
    "https://rss.itmedia.co.jp/rss/2.0/pcuser.xml",
    "https://japanese.engadget.com/rss.xml",
    "https://www.gizmodo.jp/index.xml",
    # ライフスタイル
    "https://lifehacker.jp/feed",
    # トレンド
    "https://trends.google.com/trends/trendingsearches/daily/rss?geo=JP",
    # はてなホットエントリー
    "https://b.hatena.ne.jp/hotentry/it.rss",
    "https://b.hatena.ne.jp/hotentry/life.rss",
]

# ─── ターゲットキーワード（スコアリング用カテゴリ） ────────
TARGET_KEYWORDS = [
    "リュック", "バッグ", "イヤホン", "ノイズキャンセリング", "PCスタンド",
    "ルーター", "Wi-Fi", "モバイルバッテリー", "充電器", "キーボード",
    "マウス", "ウェブカメラ", "ヘッドセット", "スニーカー", "靴",
    "ワーケーション", "リモートワーク", "テレワーク", "出張", "旅行",
    "新幹線", "カフェ", "集中", "作業", "ガジェット",
]

PRICE_RANGE_MIN = 1_000   # 安価なアクセサリも対象
PRICE_RANGE_MAX = 150_000
POST_HOUR       = 7

# ─── ML設定 ──────────────────────────────────────────────
TFIDF_MAX_FEATURES  = 500
TOP_KEYWORD_COUNT   = 5   # 1日分のキーワード候補数

# ─── パス ─────────────────────────────────────────────────
LOGS_DIR   = BASE_DIR / "logs"
DRAFTS_DIR = BASE_DIR / "drafts"
CACHE_DIR  = BASE_DIR / "cache"

for d in (LOGS_DIR, DRAFTS_DIR, CACHE_DIR):
    d.mkdir(exist_ok=True)
