# Deploy na Streamlit Cloud

## 1) Co musi byc w repo
- `streamlit_app.py`
- `requirements.txt`
- `index.html`
- `styles.css`
- `app.js`

## 2) Lokalny test (opcjonalnie)
W katalogu projektu:

```powershell
streamlit run streamlit_app.py
```

Jesli odpali, wejdź na adres pokazany w terminalu (zwykle `http://localhost:8501`).

## 3) Wrzucenie na GitHub
Wrzuc te pliki do nowego repo (publiczne wystarczy do tego use-case).

## 4) Publikacja na Streamlit Cloud
1. Wejdz na: https://share.streamlit.io/
2. Zaloguj się kontem GitHub.
3. `New app`.
4. Wybierz repozytorium.
5. `Main file path`: `streamlit_app.py`
6. Kliknij `Deploy`.

Po kilku minutach dostaniesz publiczny link, ktory trener moze otwierac na telefonie.

## 5) Uwagi mobilne
- Dzwiek (beep) zadziała po pierwszej interakcji z aplikacją (np. klik `Start`).
- Na telefonie dzwiek moze byc wyciszony przez tryb cichy systemu.
