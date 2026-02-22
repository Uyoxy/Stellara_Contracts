export async function ensureOrdering(event: any) {
  // Compare blockNumber with last processed block
  // Ensure events are processed sequentially
}

export function deduplicate(events: any[]) {
  const seen = new Set();
  return events.filter(e => {
    if (seen.has(e.eventId)) return false;
    seen.add(e.eventId);
    return true;
  });
}
