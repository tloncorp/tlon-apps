package io.tlon.landscape

import java.io.File
import java.io.FileInputStream

/**
 * ART reports a failed `pthread_create` as an OutOfMemoryError, and the crash
 * report blames whichever thread happened to start last rather than the pool
 * that filled the process (TLON-6956). This attaches a count of the process's
 * threads by name as the error's cause, so the Crashlytics report names the
 * leak.
 *
 * Install after Crashlytics has installed its handler, so that it sees the
 * cause.
 */
object ThreadExhaustionDiagnostics {
    private const val MAX_NAMES = 15
    private val DIGITS = Regex("\\d+")

    fun install() {
        val next = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            if (isThreadExhaustion(error)) {
                // Reading /proc must never stop the crash itself from being
                // reported, so a census that fails is dropped.
                runCatching { error.initCause(ThreadCensus(census(File("/proc/self/task")))) }
            }
            next.uncaughtException(thread, error)
        }
    }

    internal fun isThreadExhaustion(error: Throwable): Boolean =
        error is OutOfMemoryError && error.message?.startsWith("pthread_create") == true

    /**
     * Counts the threads under [taskDir] by their kernel name (`comm`, at most
     * 15 characters, which covers native threads as well as Java ones), with
     * digits folded so that `pool-7-thread-1` and `pool-8-thread-1` count as
     * one pool.
     */
    internal fun census(taskDir: File): String {
        val tasks = taskDir.listFiles().orEmpty()
        // A process at the limit holds tens of thousands of threads; readText
        // would allocate a fresh 8K buffer for each one.
        val buffer = ByteArray(64)
        val counts = HashMap<String, Int>()
        for (task in tasks) {
            val name = runCatching {
                FileInputStream(File(task, "comm")).use { String(buffer, 0, maxOf(it.read(buffer), 0)) }
            }.getOrDefault("?").trim().replace(DIGITS, "#")
            counts[name] = (counts[name] ?: 0) + 1
        }
        val sorted = counts.entries.sortedByDescending { it.value }
        val top = sorted.take(MAX_NAMES).joinToString(", ") { "${it.value} ${it.key}" }
        val rest = sorted.drop(MAX_NAMES).sumOf { it.value }
        return "${tasks.size} threads: $top" + if (rest > 0) ", $rest other" else ""
    }

    /** Carries only the census, so it adds no frames to the crash's grouping. */
    private class ThreadCensus(message: String) : Throwable(message) {
        override fun fillInStackTrace(): Throwable = this
    }
}
