-- Checkpoints must only cover days that can no longer receive votes. A row at or
-- after current_date means a partial day got frozen, and every vote cast later
-- that day would be skipped forever (the next run's watermark is already past
-- it). Silent data loss, so fail loudly instead.
SELECT as_of_date, count(*) AS artists
FROM {{ ref('elo_daily') }}
WHERE as_of_date >= current_date
GROUP BY as_of_date
