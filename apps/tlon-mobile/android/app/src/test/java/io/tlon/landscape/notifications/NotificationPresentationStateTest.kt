package io.tlon.landscape.notifications

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationPresentationStateTest {
    @Test
    fun `suppresses channel posts and threads for the active channel`() {
        val channelId = "chat/~zod/general"

        assertTrue(
            shouldSuppressNotificationPresentation(
                appIsForeground = true,
                activeChannelId = channelId,
                groupingKey = "channel/$channelId"
            )
        )
        assertTrue(
            shouldSuppressNotificationPresentation(
                appIsForeground = true,
                activeChannelId = channelId,
                groupingKey = "thread/$channelId/1700000000000"
            )
        )
    }

    @Test
    fun `suppresses direct and group dm posts and threads`() {
        assertTrue(groupingKeyTargetsChannel("ship/~nec", "~nec"))
        assertTrue(groupingKeyTargetsChannel("dm-thread/~nec/post-id", "~nec"))

        val clubId = "0v4.00000.qd4p2.it253.qs53q.s53qs"
        assertTrue(groupingKeyTargetsChannel("club/$clubId", clubId))
        assertTrue(groupingKeyTargetsChannel("dm-thread/$clubId/post-id", clubId))
    }

    @Test
    fun `shows notifications for another channel or while backgrounded`() {
        assertFalse(
            shouldSuppressNotificationPresentation(
                appIsForeground = true,
                activeChannelId = "~nec",
                groupingKey = "ship/~zod"
            )
        )
        assertFalse(
            shouldSuppressNotificationPresentation(
                appIsForeground = false,
                activeChannelId = "~nec",
                groupingKey = "ship/~nec"
            )
        )
        assertFalse(
            shouldSuppressNotificationPresentation(
                appIsForeground = true,
                activeChannelId = "~nec",
                groupingKey = null
            )
        )
    }

    @Test
    fun `does not match channel id prefixes`() {
        assertFalse(groupingKeyTargetsChannel("ship/~nec-bus", "~nec"))
        assertFalse(
            groupingKeyTargetsChannel(
                "thread/chat/~zod/general-2/post-id",
                "chat/~zod/general"
            )
        )
    }
}
