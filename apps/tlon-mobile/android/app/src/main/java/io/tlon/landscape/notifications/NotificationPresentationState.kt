package io.tlon.landscape.notifications

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
    private var appIsForeground = false

    @Volatile
    private var activeChannelId: String? = null

    @JvmStatic
    fun setAppIsForeground(isForeground: Boolean) {
        appIsForeground = isForeground
    }

    @JvmStatic
    fun setActiveChannelId(channelId: String?) {
        activeChannelId = channelId
    }

    fun shouldSuppress(groupingKey: String?): Boolean =
        shouldSuppressNotificationPresentation(
            appIsForeground = appIsForeground,
            activeChannelId = activeChannelId,
            groupingKey = groupingKey
        )
}
