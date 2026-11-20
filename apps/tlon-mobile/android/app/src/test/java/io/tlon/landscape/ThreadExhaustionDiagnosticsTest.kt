package io.tlon.landscape

import java.io.File
import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class ThreadExhaustionDiagnosticsTest {
    @Test
    fun `recognises only failed thread creation`() {
        assertTrue(
            ThreadExhaustionDiagnostics.isThreadExhaustion(
                OutOfMemoryError("pthread_create (1040KB stack) failed: Try again")
            )
        )
        assertFalse(
            ThreadExhaustionDiagnostics.isThreadExhaustion(
                OutOfMemoryError("Failed to allocate a 8208 byte allocation")
            )
        )
        assertFalse(
            ThreadExhaustionDiagnostics.isThreadExhaustion(
                RuntimeException("pthread_create failed")
            )
        )
    }

    @Test
    fun `hands the next handler the error with a census as its cause`() {
        val original = Thread.getDefaultUncaughtExceptionHandler()
        var received: Throwable? = null
        Thread.setDefaultUncaughtExceptionHandler { _, error -> received = error }
        try {
            ThreadExhaustionDiagnostics.install()
            val error = OutOfMemoryError("pthread_create (1040KB stack) failed: Try again")
            Thread.getDefaultUncaughtExceptionHandler()
                .uncaughtException(Thread.currentThread(), error)

            assertSame(error, received)
            assertTrue(error.cause!!.message!!.contains(" threads: "))
            assertEquals(0, error.cause!!.stackTrace.size)
        } finally {
            Thread.setDefaultUncaughtExceptionHandler(original)
        }
    }

    @Test
    fun `counts threads by name with digits folded, largest first`() {
        val tasks = Files.createTempDirectory("task").toFile()
        val names = List(3) { "pool-${it + 2}-thread-1" } +
            listOf("OkHttp TaskRun", "OkHttp TaskRun", "mqt_v_js")
        names.forEachIndexed { tid, name ->
            File(tasks, "${1000 + tid}").apply { mkdir() }
                .resolve("comm").writeText("$name\n")
        }

        assertEquals(
            "6 threads: 3 pool-#-thread-#, 2 OkHttp TaskRun, 1 mqt_v_js",
            ThreadExhaustionDiagnostics.census(tasks)
        )
    }
}
