WITH prices AS (
    SELECT *
     FROM {{ source('market', 'yahoo_raw') }}
)

SELECT

    date,
    ticker,
    close,
    volume

FROM prices