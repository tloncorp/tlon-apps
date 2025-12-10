package io.tlon.landscape

import android.util.Log
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactContext
import com.posthog.PostHog
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/**
 * Monitors JS thread responsiveness. Logs to PostHog if JS thread doesn't respond within timeout.
 */
object JSThreadMonitor {
    private const val TAG = "JSThreadMonitor"
    private const val JS_THREAD_UNRESPONSIVE_EVENT = "JS Thread Unresponsive"
    private const val JS_THREAD_RECOVERED_EVENT = "JS Thread Recovered"

    // Configuration
    private const val CHECK_INTERVAL_MS = 5000L // Check every 5 seconds
    private const val RESPONSE_TIMEOUT_MS = 2000L // Consider unresponsive after 2 seconds

    private val scheduler = Executors.newSingleThreadScheduledExecutor { r ->
        Thread(r, "JSThreadMonitor").apply { isDaemon = true }
    }

    private var monitoringTask: ScheduledFuture<*>? = null
    private var reactApplication: ReactApplication? = null
    private val isMonitoring = AtomicBoolean(false)
    private val consecutiveFailures = AtomicInteger(0)
    private val wasUnresponsive = AtomicBoolean(false)
    private val cachedReactContext = AtomicReference<ReactContext?>(null)

    @JvmStatic
    fun setReactContext(context: ReactContext) {
        Log.d(TAG, "ReactContext provided")
        cachedReactContext.set(context)
    }

    @JvmStatic
    fun startMonitoring(application: ReactApplication) {
        if (isMonitoring.getAndSet(true)) {
            return
        }

        reactApplication = application
        consecutiveFailures.set(0)
        wasUnresponsive.set(false)

        monitoringTask = scheduler.scheduleWithFixedDelay(
            { checkJSThreadResponsiveness() },
            CHECK_INTERVAL_MS,
            CHECK_INTERVAL_MS,
            TimeUnit.MILLISECONDS
        )

        Log.d(TAG, "Started JS thread monitoring")
    }

    @JvmStatic
    fun stopMonitoring() {
        if (!isMonitoring.getAndSet(false)) {
            return
        }

        monitoringTask?.cancel(false)
        monitoringTask = null
        reactApplication = null
        Log.d(TAG, "Stopped JS thread monitoring")
    }

    private fun checkJSThreadResponsiveness() {
        val app = reactApplication ?: return

        // Only check when the app is in the foreground
        if (!AppLifecycleManager.isInForeground) {
            return
        }

        val reactContext = cachedReactContext.get() ?: return

        val responded = AtomicBoolean(false)
        val checkStartTime = System.currentTimeMillis()

        try {
            reactContext.runOnJSQueueThread {
                responded.set(true)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to post task to JS thread: ${e.message}")
            return
        }

        scheduler.schedule({
            val responseTime = System.currentTimeMillis() - checkStartTime

            if (responded.get()) {
                val previousFailures = consecutiveFailures.getAndSet(0)
                if (wasUnresponsive.getAndSet(false)) {
                    logRecoveryEvent(previousFailures, responseTime)
                }
            } else {
                val failures = consecutiveFailures.incrementAndGet()
                Log.w(TAG, "JS thread unresponsive (failure $failures)")

                wasUnresponsive.set(true)
                logUnresponsiveEvent(failures)
            }
        }, RESPONSE_TIMEOUT_MS, TimeUnit.MILLISECONDS)
    }

    private fun logUnresponsiveEvent(consecutiveFailureCount: Int) {
        try {
            val properties = mutableMapOf<String, Any>(
                "source" to "native_android",
                "\$lib" to "android-js-thread-monitor",
                "\$lib_version" to "1.0.0",
                "consecutive_failures" to consecutiveFailureCount,
                "check_interval_ms" to CHECK_INTERVAL_MS,
                "timeout_ms" to RESPONSE_TIMEOUT_MS,
                "is_foreground" to AppLifecycleManager.isInForeground
            )

            PostHog.capture(JS_THREAD_UNRESPONSIVE_EVENT, properties = properties)
            Log.w(TAG, "JS thread unresponsive event logged to PostHog")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to log to PostHog: ${e.message}")
        }
    }

    private fun logRecoveryEvent(previousFailureCount: Int, recoveryResponseTimeMs: Long) {
        try {
            val properties = mutableMapOf<String, Any>(
                "source" to "native_android",
                "\$lib" to "android-js-thread-monitor",
                "\$lib_version" to "1.0.0",
                "previous_consecutive_failures" to previousFailureCount,
                "recovery_response_time_ms" to recoveryResponseTimeMs
            )

            PostHog.capture(JS_THREAD_RECOVERED_EVENT, properties = properties)
            Log.d(TAG, "JS thread recovery event logged to PostHog")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to log recovery to PostHog: ${e.message}")
        }
    }
}
