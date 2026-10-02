import { authorizeSchedulerRequest } from './scheduler-auth'

export type SchedulerRunResult = { ok: boolean; [key: string]: unknown }

export async function handleSchedulerRequest<T extends SchedulerRunResult>(
  request: Request,
  expectedToken: string | undefined,
  runJobs: () => Promise<T>,
) {
  const auth = authorizeSchedulerRequest(request, expectedToken)
  if (!auth.configured) return { status: 503, body: { error: 'Service unavailable.' } }
  if (!auth.authorized) return { status: 401, body: { error: 'Unauthorized.' } }

  const result = await runJobs()
  return { status: result.ok ? 200 : 503, body: result }
}
