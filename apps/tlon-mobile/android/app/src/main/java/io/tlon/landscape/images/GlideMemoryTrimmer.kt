package io.tlon.landscape.images

import android.content.ComponentCallbacks2
import android.content.Context
import com.bumptech.glide.Glide

/**
 * Glide registers its own [ComponentCallbacks2], but `onTrimMemory` only fires
 * when the *system* is short on memory. We die of ART's per-process growth
 * limit (256 MB) while the device still reports gigabytes free and
 * `low_memory: false`, so that callback never arrives and nothing ever prunes
 * the image cache. Half of those OOMs land while the process is backgrounded,
 * where the cache has no user-visible value at all — so prune it ourselves.
 *
 * See TLON-6505.
 */
object GlideMemoryTrimmer {
    /**
     * Fraction of the growth limit above which we drop the image cache outright
     * rather than merely trimming it. Below it we keep the cache warm so
     * switching away and straight back doesn't re-decode every image. Kept low
     * because a heap dump sat at 42% with an OOM plainly in reach, and the
     * cache is worth nothing while backgrounded.
     *
     * Note this only reaches cache-held content. Live animated decoders are
     * held by their drawables, not the cache, and are bounded by
     * [AnimatedImageHeapGuard] instead.
     */
    private const val CLEAR_THRESHOLD = 0.3f

    /** Must run on the main thread; Glide asserts that for both calls below. */
    @JvmStatic
    fun onBackground(context: Context) {
        val runtime = Runtime.getRuntime()
        val used = runtime.totalMemory() - runtime.freeMemory()
        val glide = Glide.get(context)
        if (used.toFloat() / runtime.maxMemory().toFloat() >= CLEAR_THRESHOLD) {
            glide.clearMemory()
        } else {
            glide.trimMemory(ComponentCallbacks2.TRIM_MEMORY_BACKGROUND)
        }
    }
}
