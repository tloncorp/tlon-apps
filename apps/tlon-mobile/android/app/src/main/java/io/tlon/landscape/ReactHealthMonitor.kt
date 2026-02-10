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

object ReactHealthMonitor {
    private const val TAG = "ReactHealthMonitor"
    private const val LIB = "android-react-health-monitor"

    private val scheduler = Executors.newSingleThreadScheduledExecutor { Thread(it, TAG).apply { isDaemon = true } }
    private var contextTask: ScheduledFuture<*>? = null
    private var threadTask: ScheduledFuture<*>? = null
    private var heartbeatTask: ScheduledFuture<*>? = null

    private var app: ReactApplication? = null
    private val context = AtomicReference<ReactContext?>(null)
    private var eventType = "launch"
    private var isFirstStart = true
    var isInForeground = false
        private set

    private val contextRetries = AtomicInteger(0)
    private val contextFailed = AtomicBoolean(false)
    private val threadFailed = AtomicBoolean(false)
    private val threadFailures = AtomicInteger(0)
    private val awaitingHeartbeat = AtomicBoolean(false)
    private val heartbeatFailures = AtomicInteger(0)

    @JvmStatic
    fun setReactContext(ctx: ReactContext) = context.set(ctx)

    @JvmStatic
    fun start(application: ReactApplication) {
        isInForeground = true
        app = application
        eventType = if (isFirstStart) "launch" else "resume"
        isFirstStart = false

        contextRetries.set(0)
        contextTask?.cancel(false)
        contextTask = scheduler.schedule(::checkContext, 500, TimeUnit.MILLISECONDS)

        threadTask?.cancel(false)
        threadFailures.set(0)
        threadFailed.set(false)
        threadTask = scheduler.scheduleWithFixedDelay(::checkThread, 5000, 5000, TimeUnit.MILLISECONDS)

        awaitingHeartbeat.set(true)
        heartbeatTask?.cancel(false)
        heartbeatTask = scheduler.schedule(::onHeartbeatTimeout, 2000, TimeUnit.MILLISECONDS)
    }

    @JvmStatic
    fun stop() {
        isInForeground = false
        listOf(contextTask, threadTask, heartbeatTask).forEach { it?.cancel(false) }
        contextTask = null
        threadTask = null
        heartbeatTask = null
        awaitingHeartbeat.set(false)
    }

    @JvmStatic
    fun signalJsReady() {
        if (awaitingHeartbeat.getAndSet(false)) {
            heartbeatTask?.cancel(false)
            heartbeatTask = null
            heartbeatFailures.set(0)
        }
    }

    private fun checkContext() {
        val application = app ?: return
        var ctx = context.get() ?: runCatching {
            application.reactNativeHost.reactInstanceManager?.currentReactContext
        }.getOrNull()

        val hasActive = ctx?.let { runCatching { it.hasActiveReactInstance() }.getOrDefault(false) } ?: false
        val hasCatalyst = ctx?.let { runCatching { it.catalystInstance != null }.getOrDefault(false) } ?: false

        if (hasActive && hasCatalyst) {
            if (context.get() == null) context.set(ctx)
            val retries = contextRetries.get()
            if (contextFailed.getAndSet(false) || retries > 0) {
                capture(if (contextFailed.get()) "React Context Recovered" else "React Context Available",
                    "event_type" to eventType, "retries" to retries)
            }
        } else {
            val retry = contextRetries.incrementAndGet()
            if (retry < 5) {
                contextTask = scheduler.schedule(::checkContext, 1000, TimeUnit.MILLISECONDS)
            } else {
                contextFailed.set(true)
                Log.e(TAG, "Context unavailable after retries")
                capture("React Context Unavailable", "event_type" to eventType, "has_active" to hasActive, "has_catalyst" to hasCatalyst)
            }
        }
    }

    private fun checkThread() {
        if (!isInForeground) return
        val ctx = context.get() ?: return

        val responded = AtomicBoolean(false)
        val start = System.currentTimeMillis()

        runCatching { ctx.runOnJSQueueThread { responded.set(true) } }.onFailure { return }

        scheduler.schedule({
            if (responded.get()) {
                if (threadFailed.getAndSet(false)) {
                    capture("JS Thread Recovered", "previous_failures" to threadFailures.getAndSet(0),
                        "recovery_ms" to (System.currentTimeMillis() - start))
                }
            } else {
                threadFailed.set(true)
                capture("JS Thread Unresponsive", "failures" to threadFailures.incrementAndGet())
            }
        }, 2000, TimeUnit.MILLISECONDS)
    }

    private fun onHeartbeatTimeout() {
        if (awaitingHeartbeat.getAndSet(false)) {
            Log.e(TAG, "JS boot timeout (event: $eventType)")
            capture("JS Boot Failure", "event_type" to eventType, "failures" to heartbeatFailures.incrementAndGet())
        }
    }

    private fun capture(event: String, vararg props: Pair<String, Any>) {
        runCatching {
            PostHog.capture(event, properties = mapOf(
                "source" to "native_android",
                "\$lib" to LIB,
                "is_foreground" to isInForeground
            ) + props.toMap())
        }
    }
}
