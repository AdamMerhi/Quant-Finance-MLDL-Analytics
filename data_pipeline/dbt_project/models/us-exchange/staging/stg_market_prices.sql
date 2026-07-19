WITH prices AS (
    SELECT *
     FROM {{ source('market', 'yahoo_raw') }}
)

SELECT

    try_cast(date AS DATE) AS date,
    ticker,
    close,
    volume

FROM prices