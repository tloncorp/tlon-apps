package io.tlon.landscape.notifications

import com.android.volley.ClientError
import com.android.volley.NoConnectionError
import com.android.volley.TimeoutError
import java.net.UnknownHostException
import org.junit.Assert.assertEquals
import org.junit.Test

class NotificationLoggerTest {
    @Test
    fun `names volley errors and their wrapped causes`() {
        assertEquals("TimeoutError", TimeoutError().stableTypeName())
        assertEquals("ClientError", ClientError().stableTypeName())

        val noConnection = NoConnectionError(UnknownHostException("ship.tlon.network"))
        assertEquals("NoConnectionError", noConnection.stableTypeName())
        assertEquals("UnknownHostException", noConnection.cause!!.stableTypeName())
    }
}
