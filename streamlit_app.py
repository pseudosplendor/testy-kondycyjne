from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components


BASE_DIR = Path(__file__).parent
HTML_FILE = BASE_DIR / "index.html"
CSS_FILE = BASE_DIR / "styles.css"
JS_FILE = BASE_DIR / "app.js"


def load_embedded_app() -> str:
    html = HTML_FILE.read_text(encoding="utf-8")
    css = CSS_FILE.read_text(encoding="utf-8")
    js = JS_FILE.read_text(encoding="utf-8")

    html = html.replace(
        '<link rel="stylesheet" href="styles.css">',
        f"<style>\n{css}\n</style>",
    )
    html = html.replace(
        '<script src="app.js"></script>',
        f"<script>\n{js}\n</script>",
    )
    return html


st.set_page_config(
    page_title="Testy Kondycyjne",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
    <style>
      [data-testid="stHeader"] { display: none; }
      [data-testid="stToolbar"] { display: none; }
      .block-container {
        padding-top: 0.8rem;
        padding-bottom: 0.8rem;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

try:
    embedded_html = load_embedded_app()
except FileNotFoundError as error:
    st.error(f"Brakuje pliku aplikacji: {error}")
else:
    components.html(embedded_html, height=1900, scrolling=True)
