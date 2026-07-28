-- Checkpoints must only cover days that can no longer receive votes. A row at or
-- after current_date means a partial day got frozen, and every vote cast later
-- that day would be skipped forever (the next run's watermark is already past
-- it). Silent data loss, so fail loudly instead.
select
    as_of_date,
    count(*) as artists
from {{ ref('elo_daily') }}
where as_of_date >= current_date
group by as_of_date
