DELETE
FROM locations
WHERE location_id IN
    (SELECT location_id
     FROM
       (SELECT loc1.location_id,
               loc1.device_id,
               loc1.created_at,
               COUNT(*) num
        FROM locations loc1
        JOIN locations loc2 ON ((loc1.device_id = loc2.device_id)
                                OR (loc1.device_id IS NULL
                                    AND loc2.device_id IS NULL))
        AND loc1.created_at <= loc2.created_at
        GROUP BY loc1.location_id,
                 loc1.device_id,
                 loc1.created_at
        HAVING COUNT(*) > 10
        ORDER BY device_id,
                 created_at) AS location_id);