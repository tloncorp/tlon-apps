package io.tlon.landscape.notifications

import android.util.Log
import com.posthog.PostHog

object NotificationLogger {
    fun logNotificationEvent(eventName: String, properties: Map<String, Any> = emptyMap()) {
        try {
            PostHog.capture(eventName, properties = properties)
        } catch (e: Exception) {
            Log.d("PostHogFallback", "Event: $eventName, Properties: $properties, Error: ${e.message}")
        }
    }
}