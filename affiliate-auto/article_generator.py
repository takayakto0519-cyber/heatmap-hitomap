"""
Claude API で記事本文を自動生成する
- ANTHROPIC_API_KEY が空の場合はプロンプトをそのまま返す（GPTs手動コピー用）
- 成功時は 3000〜4000字のMarkdown記事を返す
"""
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL


def generate_article(prompt: str, keyword: str = "") -> tuple[str, bool]:
    """
    プロンプトを受け取り、Claude API で記事を生成する。
    戻り値: (記事テキスト, AI生成フラグ)
    """
    if not ANTHROPIC_API_KEY:
        print(f"[generator] ANTHROPIC_API_KEY 未設定 — プロンプトをそのまま返します")
        return prompt, False

    try:
        import anthropic
    except ImportError:
        print("[generator] anthropic パッケージ未インストール: pip install anthropic")
        return prompt, False

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        print(f"[generator] Claude API 呼び出し中: {keyword or 'unknown'} / model={CLAUDE_MODEL}")

        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        article_text = message.content[0].text
        print(f"[generator] 生成完了: {len(article_text)}文字")
        return article_text, True

    except Exception as e:
        print(f"[generator] API エラー: {e} — プロンプトにフォールバック")
        return prompt, False
