select 
    *
from
    file
where
    id = '${fileId}'
    and is_active = true;