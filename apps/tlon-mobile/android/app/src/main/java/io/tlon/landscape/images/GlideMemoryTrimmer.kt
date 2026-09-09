package io.tlon.landscape.images

import android.content.ComponentCallbacks2
import android.content.Context
import com.bumptech.glide.Glide

/**
 * Prunes Glide's memory cache when the process backgrounds.
 *
 * Glide registers its own [ComponentCallbacks2], but `onTrimMemory` only fires
 * when the *system* is short of memory. We die of ART's per-process growth
 * limit instead, while the device still reports gigabytes free and
 * `low_memory: false` — so that callback never arrives and nothing ever prunes
 * the cache. Half of those OOMs (TLON-6505) happened with
 * `in_foreground: false`, where the cache has no user-visible value at all.
 *
 * Levels are chosen against what `LruResourceCache.trimMemory` actually does:
 * `>= TRIM_MEMORY_BACKGROUND` (40) clears the cache outright, while
 * `>= TRIM_MEMORY_UI_HIDDEN` (20) halves it. Passing BACKGROUND in both
 * branches would make the low-usage branch a full clear too, which is not what
 * we want — returning to a channel would re-read and re-decode every image
 * after a quick app switch.
 */
object GlideMemoryTrimmer {
    /**
     * Fraction of the growth limit above which we drop the cache outright
     * rather than halving it. Kept low because a heap dump sat at 42% with an
     * OOM plainly in reach.
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
            glide.trimMemory(ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN)
        }
    }
}
