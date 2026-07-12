import yfinance as yf


TICKERS = [
    "IVV",
    "VOO",
    "^IXIC"
]


def extract():

    raw = yf.download(
        tickers=TICKERS,
        start="2020-01-01",
        group_by="ticker",
        auto_adjust=False
    )

    long_df = (
        raw
        .stack(level="Ticker", future_stack=True)
        .reset_index()
        .rename(columns={
            "Date": "date",
            "Ticker": "ticker",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Adj Close": "adj_close",
            "Volume": "volume",
        })
    )

    return long_df
