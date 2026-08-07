::  steward automation module: scheduled tasks
|%
::type PluginHookGatewayCronRunStatus = "ok" | "error" | "skipped";
+$  cron-run-status  ?(%ok %error %skipped)
::type PluginHookGatewayCronDeliveryStatus = "not-requested" | "delivered" | "not-delivered" | "unknown";
+$  cron-delivery-status
  ?(%not-requested %delivered %not-delivered %unknown)
::type PluginHookGatewayCronJobState = {
::  nextRunAtMs?: number;
::  runningAtMs?: number;
::  lastRunAtMs?: number;
::  lastRunStatus?: PluginHookGatewayCronRunStatus;
::  lastError?: string;
::  lastDurationMs?: number;
::  lastDelivered?: boolean;
::  lastDeliveryStatus?: PluginHookGatewayCronDeliveryStatus;
::  lastDeliveryError?: string;
::  lastFailureNotificationDelivered?: boolean;
::  lastFailureNotificationDeliveryStatus?: PluginHookGatewayCronDeliveryStatus;
::  lastFailureNotificationDeliveryError?: string;
::};
+$  cron-job-state
  $:  next-run-at=(unit @da)
      running-at=(unit @da)
      last-run-at=(unit @da)
      last-run-status=(unit cron-run-status)
      last-error=(unit @t)
      last-duration=(unit @dr)
      last-delivered=(unit ?)
      last-delivery-status=(unit cron-delivery-status)
      last-delivery-error=(unit @t)
      last-failure-notification-delivered=(unit ?)
      last-failure-notification-delivery-status=(unit cron-delivery-status)
      last-failure-notification-delivery-error=(unit @t)
  ==
::type PluginHookGatewayCronJob = {
::  id: string; /** Agent id that owns this cron job. */
::  agentId?: string;
::  name?: string;
::  description?: string;
::  enabled?: boolean;
::  schedule?: {
::    kind: "cron";
::    expr?: string;
::    tz?: string;
::    staggerMs?: number;
::  } | {
::    kind: "at";
::    at?: string;
::  } | {
::    kind: "every";
::    everyMs?: number;
::    anchorMs?: number;
::  };
::  sessionTarget?: string;
::  wakeMode?: string;
::  payload?: {
::    kind?: string;
::    text?: string;
::  };
::  state?: PluginHookGatewayCronJobState;
::  createdAtMs?: number;
::  updatedAtMs?: number;
::};
+$  cron-schedule
  $%  [%cron expr=(unit @t) tz=(unit @t) stagger=(unit @dr)]
      [%at at=(unit @da)]
      [%every every=(unit @dr) anchor=(unit @da)]
  ==
+$  cron-payload
  $:  kind=(unit @t)
      text=(unit @t)
  ==
+$  cron-job
  $:  id=@t
      agent-id=(unit @t)
      name=(unit @t)
      description=(unit @t)
      enabled=(unit ?)
      schedule=(unit cron-schedule)
      session-target=(unit @t)
      wake-mode=(unit @t)
      payload=(unit cron-payload)
      state=(unit cron-job-state)
      created-at=(unit @da)
      updated-at=(unit @da)
  ==
::type PluginHookCronChangedEvent = {
::  action: "added" | "updated" | "removed" | "started" | "finished";
::  jobId: string;
::  job?: PluginHookGatewayCronJob; /** Top-level session target for downstream routing (mirrors job.sessionTarget). */
::  sessionTarget?: string; /** Agent id that owns this cron job (mirrors job.agentId). */
::  agentId?: string;
::  runAtMs?: number;
::  durationMs?: number;
::  status?: PluginHookGatewayCronRunStatus;
::  error?: string;
::  summary?: string;
::  delivered?: boolean;
::  deliveryStatus?: PluginHookGatewayCronDeliveryStatus;
::  deliveryError?: string;
::  sessionId?: string;
::  sessionKey?: string;
::  runId?: string;
::  nextRunAtMs?: number;
::  model?: string;
::  provider?: string;
::};
+$  cron-changed-event
  $:  action=?(%added %updated %removed %started %finished)
      job-id=@t
      job=(unit cron-job)
      session-target=(unit @t)
      agent-id=(unit @t)
      run-at=(unit @da)
      duration=(unit @dr)
      status=(unit cron-run-status)
      error=(unit @t)
      summary=(unit @t)
      delivered=(unit ?)
      delivery-status=(unit cron-delivery-status)
      delivery-error=(unit @t)
      session-id=(unit @t)
      session-key=(unit @t)
      run-id=(unit @t)
      next-run-at=(unit @da)
      model=(unit @t)
      provider=(unit @t)
  ==
++  v1  .
--
