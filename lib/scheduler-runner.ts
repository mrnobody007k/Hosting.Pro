type FailedJob = { failed: 1; error: 'UNAVAILABLE' }

/** Run both bounded jobs even if one stage throws; never pass raw errors through. */
export async function runIndependentSchedulerJobs<TDaily extends { failed: number }, TRerent extends { failed: number }>(
  runDaily: () => Promise<TDaily>,
  runReRent: () => Promise<TRerent>,
) {
  let daily: TDaily | FailedJob
  let rerent: TRerent | FailedJob

  try {
    daily = await runDaily()
  } catch {
    console.error('SCHEDULER_DAILY_BATCH_FAILED')
    daily = { failed: 1, error: 'UNAVAILABLE' }
  }

  try {
    rerent = await runReRent()
  } catch {
    console.error('SCHEDULER_RERENT_BATCH_FAILED')
    rerent = { failed: 1, error: 'UNAVAILABLE' }
  }

  return { ok: daily.failed === 0 && rerent.failed === 0, daily, rerent }
}
