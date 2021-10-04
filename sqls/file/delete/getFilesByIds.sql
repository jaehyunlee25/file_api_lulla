select 
    *
from
    file
where
    id in (${fileId})
    and is_active = true;