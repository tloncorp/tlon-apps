package io.tlon.landscape

import android.util.Log
import com.posthog.PostHog
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Monitors JS boot/resume readiness. Logs to PostHog if JS fails to signal within timeout.
 */
object JSHeartbeatMonitor {
    private const val TAG = "JSHeartbeatMonitor"
    private const val JS_BOOT_FAILURE_EVENT = "JS Boot Failure"
    private const val HEARTBEAT_TIMEOUT_MS = 2000L

    private val scheduler = Executors.newSingleThreadScheduledExecutor { r ->
        Thread(r, "JSHeartbeatMonitor").apply { isDaemon = true }
    }

    private var timeoutTask: ScheduledFuture<*>? = null
    private val isWaitingForHeartbeat = AtomicBoolean(false)
    private val consecutiveFailures = AtomicInteger(0)
    private var currentEventType: String = "launch"

    @JvmStatic
    fun expectHeartbeat(eventType: String) {
        timeoutTask?.cancel(false)

        currentEventType = eventType
        isWaitingForHeartbeat.set(true)

        Log.d(TAG, "Expecting JS heartbeat within ${HEARTBEAT_TIMEOUT_MS}ms (event: $eventType)")

        timeoutTask = scheduler.schedule({
            if (isWaitingForHeartbeat.getAndSet(false)) {
                val failures = consecutiveFailures.incrementAndGet()
                Log.e(TAG, "JS failed to signal readiness (failure $failures, event: $currentEventType)")
                logBootFailureEvent(failures)
            }
        }, HEARTBEAT_TIMEOUT_MS, TimeUnit.MILLISECONDS)
    }

    @JvmStatic
    fun signalReady() {
        if (isWaitingForHeartbeat.getAndSet(false)) {
            timeoutTask?.cancel(false)
            timeoutTask = null
            consecutiveFailures.set(0)
            Log.d(TAG, "JS signaled ready (event: $currentEventType)")
        } else {
            Log.d(TAG, "JS signaled ready but no heartbeat was expected")
        }
    }

    @JvmStatic
    fun cancelExpectation() {
        isWaitingForHeartbeat.set(false)
        timeoutTask?.cancel(false)
        timeoutTask = null
        Log.d(TAG, "Heartbeat expectation cancelled")
    }

    private fun logBootFailureEvent(consecutiveFailureCount: Int) {
        try {
            val properties = mutableMapOf<String, Any>(
                "source" to "native_android",
                "\$lib" to "android-js-heartbeat-monitor",
                "\$lib_version" to "1.0.0",
                "event_type" to currentEventType,
                "consecutive_failures" to consecutiveFailureCount,
                "timeout_ms" to HEARTBEAT_TIMEOUT_MS,
                "is_foreground" to AppLifecycleManager.isInForeground
            )

            PostHog.capture(JS_BOOT_FAILURE_EVENT, properties = properties)
            Log.w(TAG, "JS boot failure event logged to PostHog (event: $currentEventType)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to log to PostHog: ${e.message}")
        }
    }
}
