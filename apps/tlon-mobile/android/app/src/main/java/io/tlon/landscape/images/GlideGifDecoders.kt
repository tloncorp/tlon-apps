package io.tlon.landscape.images

import android.content.Context
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.gif.ByteBufferGifDecoder
import com.bumptech.glide.load.resource.gif.GifDrawable
import com.bumptech.glide.load.resource.gif.StreamGifDecoder
import java.io.InputStream
import java.nio.ByteBuffer

/**
 * Puts Glide's own GIF decoder back in front of APNG4Android's.
 *
 * expo-image depends on APNG4Android (`com.github.penfeizhou.android.animation`)
 * for APNG, animated WebP and AVIF, and that library's Glide plugin prepends
 * decoders which also claim GIF — so on Android every animated GIF was decoded
 * by APNG4Android rather than by Glide. That path is a bad fit for us:
 *
 *  - It decodes at full native resolution, and can't be asked not to.
 *    `ByteBufferAnimationDecoder.decode` discards the target size Glide passes
 *    it, and the only other source of a sample size —
 *    `FrameAnimationDrawable.setBounds` — is handed the drawable's intrinsic
 *    size by ImageView, so `getDesiredSample` always answers 1. Setting a
 *    sample size directly doesn't work either: as of 3.0.5 the native GIF
 *    decoder ignores the `sampleSize` argument to `GifFrame.encode` and fills
 *    the smaller buffer with unscaled pixels, which comes out as stripes.
 *  - It holds three java-heap buffers at four bytes per decoded pixel (frame
 *    buffer, disposal snapshot, LZW output), none pooled or budgeted, so a
 *    single 1400x1400 GIF costs ~24MB of a 256MB ART heap.
 *  - `GifFrame.draw` catches Exception, which does not cover the
 *    OutOfMemoryError that `GifWriter.reset` throws when the heap runs out. It
 *    escapes onto a bare HandlerThread and kills the process (TLON-6494).
 *
 * Glide's decoder honours the target size, takes frame bitmaps from the shared
 * BitmapPool and scratch arrays from the ArrayPool, reports its real size to the
 * memory cache, and runs inside GlideExecutor, which catches Throwable — so
 * running out of heap fails one image instead of the app.
 *
 * These are the decoders Glide registers anyway; re-registering them with
 * `prepend` only moves them ahead of APNG4Android's in the lookup order. They
 * accept GIF data only, so APNG, animated WebP and AVIF still fall through to
 * APNG4Android.
 */
object GlideGifDecoders {
    /**
     * Call before the first image load. Glide caches resolved load paths, so
     * anything decoded before this runs would keep using APNG4Android for the
     * rest of the process. expo-image owns the app's only `AppGlideModule`, so a
     * runtime prepend is the seam available to us.
     */
    fun install(context: Context) {
        val glide = Glide.get(context)
        val parsers = glide.registry.imageHeaderParsers
        val byteBufferDecoder =
            ByteBufferGifDecoder(context, parsers, glide.bitmapPool, glide.arrayPool)
        glide.registry
            .prepend(ByteBuffer::class.java, GifDrawable::class.java, byteBufferDecoder)
            .prepend(
                InputStream::class.java,
                GifDrawable::class.java,
                StreamGifDecoder(parsers, byteBufferDecoder, glide.arrayPool),
            )
    }
}
