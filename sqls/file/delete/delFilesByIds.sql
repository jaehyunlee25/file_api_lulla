update
    file
set
    is_active = false
where
    id in (${fileId});