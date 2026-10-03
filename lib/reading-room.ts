// Fill each genre's four reading-room places in queue order.
export const promoteSQL = `UPDATE works SET status='spotlight' WHERE id IN (
  SELECT id FROM (
    SELECT id, genre, ROW_NUMBER() OVER (PARTITION BY genre ORDER BY created_at ASC, id ASC) AS rn
    FROM works WHERE status='queued'
  ) ranked
  WHERE rn <= GREATEST(0, 4 - (SELECT COUNT(*) FROM works s WHERE s.status='spotlight' AND s.genre = ranked.genre))
)`;
