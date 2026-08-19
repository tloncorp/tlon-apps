package io.tlon.landscape.notifications

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner

internal fun groupingKeyTargetsChannel(
    groupingKey: String?,
    channelId: String?
): Boolean {
    if (groupingKey == null || channelId == null) {
        return false
    }

    return groupingKey == "channel/$channelId" ||
        groupingKey.startsWith("thread/$channelId/") ||
        groupingKey == "ship/$channelId" ||
        groupingKey == "club/$channelId" ||
        groupingKey.startsWith("dm-thread/$channelId/")
}

internal fun shouldSuppressNotificationPresentation(
    appIsForeground: Boolean,
    activeChannelId: String?,
    groupingKey: String?
): Boolean = appIsForeground && groupingKeyTargetsChannel(groupingKey, activeChannelId)

object NotificationPresentationState {
    @Volatile
    private var activeChannelId: String? = null

    @JvmStatic
    fun setActiveChannelId(channelId: String?) {
        activeChannelId = channelId
    }

    fun shouldSuppress(groupingKey: String?): Boolean =
        shouldSuppressNotificationPresentation(
            appIsForeground = ProcessLifecycleOwner.get().lifecycle.currentState
                .isAtLeast(Lifecycle.State.RESUMED),
            activeChannelId = activeChannelId,
            groupingKey = groupingKey
        )
}
