// Live workloads retain ship events even when their fixture sessions are deleted.
// Import before transport modules so refusal precedes credentials or connections.
if (process.env.HARNESS_HEAVY_TESTS !== '1') {
  throw new Error('Disk-intensive live tests are disabled. Set HARNESS_HEAVY_TESTS=1 only for an explicitly selected test ship with a monitored disk budget. Fixture cleanup does not reclaim the ship event log.')
}
