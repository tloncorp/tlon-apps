package io.tlon.landscape.notifications

import android.util.Log
import com.posthog.PostHog

private const val NOTIFICATION_SERVICE_ERROR = "Notification Service Error"
private const val NOTIFICATION_SERVICE_DELIVERED = "Notification Service Delivery Successful"

object NotificationLogger {
    fun logError(properties: Map<String, Any> = emptyMap()) {
        log(NOTIFICATION_SERVICE_ERROR, properties = properties)
    }

    fun logDelivery(properties: Map<String, Any> = emptyMap()) {
        log(NOTIFICATION_SERVICE_DELIVERED, properties)
    }

    private fun log(eventName: String, properties: Map<String, Any> = emptyMap()) {
        try {
            PostHog.capture(eventName, properties = properties)
        } catch (e: Exception) {
            Log.d("PostHogFallback", "Event: $eventName, Properties: $properties, Error: ${e.message}")
        }
    }
}