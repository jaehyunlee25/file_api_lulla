insert into file(
    id,
    name,
    type,
    key,
    address,
    size,
    is_active,
    thumbnail_address,
    width,
    height,
    index,
    duration,
    created_at,
    updated_at
) values (
    uuid_generate_v1(),
    '${fileName}',
    '${type}',
    '${key}',
    '${address}',
    ${size},
    true,
    '${thumbnail_address}',
    ${width},
    ${height},
    ${index},
    ${duration},
    now(),
    now()
) 
returning id;