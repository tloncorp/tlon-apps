package io.tlon.landscape.images;

import android.content.Context;
import android.graphics.BitmapFactory;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.bumptech.glide.Glide;
import com.bumptech.glide.Registry;
import com.bumptech.glide.load.Options;
import com.bumptech.glide.load.ResourceDecoder;
import com.bumptech.glide.load.engine.Resource;
import com.github.penfeizhou.animation.decode.FrameSeqDecoder;
import com.github.penfeizhou.animation.gif.decode.GifDecoder;
import com.github.penfeizhou.animation.gif.decode.GifParser;
import com.github.penfeizhou.animation.glide.ByteBufferAnimationDecoder;
import com.github.penfeizhou.animation.glide.StreamAnimationDecoder;
import com.github.penfeizhou.animation.io.ByteBufferReader;
import com.github.penfeizhou.animation.loader.ByteBufferLoader;
import com.github.penfeizhou.animation.loader.Loader;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.util.Collections;
import java.util.Map;
import java.util.WeakHashMap;

/**
 * Bounds what animated images can cost us on the Java heap. See TLON-6505.
 *
 * <p>A live APNG4Android decoder keeps three Java-heap buffers of 4 bytes per
 * pixel — {@code FrameSeqDecoder.frameBuffer},
 * {@code GifDecoder$SnapShot.byteBuffer}, and {@code GifWriter.intBuffer},
 * which never shrinks — so 12 bytes per pixel, at
 * {@code (width / sampleSize) x (height / sampleSize)}. Static bitmaps are
 * unaffected: their pixel data lives in the native heap on API 26+, while all
 * three of these are Java heap, which is what ART's 256 MB per-process growth
 * limit actually bounds.
 *
 * <p>Two things a heap dump established, both of which shaped this:
 *
 * <ul>
 *   <li>A single 800x800 animated GIF in one message produced <em>sixteen</em>
 *       concurrent live decoders, 118 MiB, each held by its own
 *       {@code GifDrawable} rather than by Glide's cache — trimming the cache
 *       released none. The count plateaus rather than growing, so it isn't an
 *       unbounded leak; it is one decoder per decode pass, each at full
 *       resolution, all alive at once. So the binding constraint is aggregate
 *       cost across live decoders, not per-image cost and not cache size.
 *   <li>Declining a decode does <em>not</em> fall through to Glide's static
 *       decoders. {@code Registry.prepend} cannot unregister the plugin's own
 *       decoder for the same pair, so whatever we refuse it happily decodes
 *       unguarded. A guard here therefore has to return a cheaper decoder, not
 *       refuse to make one.
 * </ul>
 *
 * <p>So: for GIF — the format that matters, and the one with no downsampling of
 * its own because {@code GifDecoder.getDesiredSample} hardcodes 1 — we build
 * the decoder ourselves with {@code sampleSize} preset, chosen as the smallest
 * power of two that keeps this animation inside a per-image share of the growth
 * limit and keeps every live animation together inside a larger share. Both
 * shares scale off {@code maxMemory}, so they track {@code largeHeap} and future
 * devices. Everything else is left to the plugin.
 *
 * <p>Presetting the field matters: {@code setDesiredSize} would work through
 * {@code getDesiredSample}, whose base implementation calls {@code getBounds()}
 * and so triggers a full-resolution parse and allocation before the smaller
 * size can take effect.
 */
public final class AnimatedImageHeapGuard {
    /**
     * Per-pixel Java-heap cost of a live decoder: three buffers at 4 bytes per
     * pixel each.
     */
    private static final long HEAP_BYTES_PER_PIXEL = 12L;

    /** Share of the growth limit one animation may cost: ~12.8 MB of 256 MB. */
    private static final long PER_IMAGE_DIVISOR = 20L;

    /**
     * Share of the growth limit all live animations together may cost: ~51 MB
     * of 256 MB. Steady-state Java heap is ~25 MB, so this leaves plenty for
     * everything that isn't an image.
     */
    private static final long TOTAL_DIVISOR = 5L;

    /**
     * Past this, further halving buys little and the result is too soft to be
     * worth showing. 1/16 in each dimension is a 256x reduction in cost.
     */
    private static final int MAX_SAMPLE_SIZE = 16;

    /**
     * Decoders handed out and not yet collected, against their Java-heap cost.
     * Weak keys, so a decoder dropped by its drawable leaves on its own and this
     * can never be what retains one. The values are boxed longs, which don't
     * reference the key.
     */
    private static final Map<FrameSeqDecoder, Long> LIVE =
            Collections.synchronizedMap(new WeakHashMap<FrameSeqDecoder, Long>());

    private AnimatedImageHeapGuard() {}

    /**
     * Must run before the first image request. Initializes Glide, which runs
     * expo-image's {@code AppGlideModule} and the plugin's registrations first,
     * so these prepended decoders take precedence over them.
     */
    public static void install(@NonNull Context context) {
        ResourceDecoder<ByteBuffer, FrameSeqDecoder> guarded =
                new BudgetedDecoder(new ByteBufferAnimationDecoder());
        Registry registry = Glide.get(context).getRegistry();
        // Mirrors GlideAnimationModule's own registration. The plugin's
        // StreamAnimationDecoder reads the stream into a ByteBuffer and hands it
        // to the decoder it was constructed with, so wrapping the byte-buffer
        // decoder here covers the stream path too.
        registry.prepend(
                InputStream.class, FrameSeqDecoder.class, new StreamAnimationDecoder(guarded));
        registry.prepend(ByteBuffer.class, FrameSeqDecoder.class, guarded);
    }

    static long heapCost(long pixels) {
        return pixels * HEAP_BYTES_PER_PIXEL;
    }

    /** Cost once decoded at {@code sample}, which shrinks both dimensions. */
    static long heapCostAtSample(long pixels, int sample) {
        return heapCost(pixels) / ((long) sample * sample);
    }

    /**
     * Smallest power-of-two sample size keeping this animation inside its own
     * share of {@code growthLimit} and keeping the total, including
     * {@code liveBytes} already held, inside the larger share. Returns 1 when
     * the image already fits, and never exceeds {@link #MAX_SAMPLE_SIZE}.
     */
    static int sampleFor(long pixels, long liveBytes, long growthLimit) {
        long perImage = growthLimit / PER_IMAGE_DIVISOR;
        long total = growthLimit / TOTAL_DIVISOR;
        int sample = 1;
        while (sample < MAX_SAMPLE_SIZE) {
            long cost = heapCostAtSample(pixels, sample);
            if (cost <= perImage && liveBytes + cost <= total) {
                return sample;
            }
            sample *= 2;
        }
        return sample;
    }

    /** Java-heap bytes held by animated decoders that are still reachable. */
    private static long liveHeapBytes() {
        long total = 0L;
        synchronized (LIVE) {
            for (Long cost : LIVE.values()) {
                total += cost;
            }
        }
        return total;
    }

    /** Pixel count from the header alone, or -1 if the format didn't report it. */
    private static long pixelCount(ByteBuffer source) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        // Operate on a rewound duplicate: the buffer's position is shared with
        // the loader, which reads it lazily on the decode thread.
        ByteBuffer buffer = source.duplicate();
        buffer.rewind();
        if (buffer.hasArray()) {
            BitmapFactory.decodeByteArray(
                    buffer.array(), buffer.arrayOffset(), buffer.remaining(), bounds);
        } else {
            byte[] bytes = new byte[buffer.remaining()];
            buffer.get(bytes);
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
            return -1;
        }
        return (long) bounds.outWidth * (long) bounds.outHeight;
    }

    private static boolean isGif(ByteBuffer source) {
        ByteBuffer buffer = source.duplicate();
        buffer.rewind();
        return GifParser.isGif(new ByteBufferReader(buffer));
    }

    private static final class BudgetedDecoder
            implements ResourceDecoder<ByteBuffer, FrameSeqDecoder> {
        private final ResourceDecoder<ByteBuffer, FrameSeqDecoder> delegate;

        BudgetedDecoder(ResourceDecoder<ByteBuffer, FrameSeqDecoder> delegate) {
            this.delegate = delegate;
        }

        @Override
        public boolean handles(@NonNull ByteBuffer source, @NonNull Options options)
                throws IOException {
            return delegate.handles(source, options);
        }

        @Nullable
        @Override
        public Resource<FrameSeqDecoder> decode(
                @NonNull final ByteBuffer source,
                int width,
                int height,
                @NonNull Options options)
                throws IOException {
            long pixels = pixelCount(source);
            // Unknown dimensions (e.g. AVIF below API 31), or a format we don't
            // take over: leave it to the plugin rather than guessing.
            if (pixels < 0 || !isGif(source)) {
                return trackIfKnown(delegate.decode(source, width, height, options), pixels, 1);
            }
            int sample;
            synchronized (LIVE) {
                sample = sampleFor(pixels, liveHeapBytes(), Runtime.getRuntime().maxMemory());
            }
            if (sample <= 1) {
                return trackIfKnown(delegate.decode(source, width, height, options), pixels, 1);
            }
            Loader loader =
                    new ByteBufferLoader() {
                        @Override
                        public ByteBuffer getByteBuffer() {
                            ByteBuffer buffer = source.duplicate();
                            buffer.rewind();
                            return buffer;
                        }
                    };
            return trackIfKnown(
                    new DecoderResource(new SampledGifDecoder(loader, sample)), pixels, sample);
        }

        @Nullable
        private Resource<FrameSeqDecoder> trackIfKnown(
                @Nullable Resource<FrameSeqDecoder> decoded, long pixels, int sample) {
            if (decoded != null && pixels >= 0) {
                LIVE.put(decoded.get(), heapCostAtSample(pixels, sample));
            }
            return decoded;
        }
    }

    /**
     * A {@link GifDecoder} pinned to a sample size we picked up front, rather
     * than the hardcoded 1 the class would otherwise use.
     */
    private static final class SampledGifDecoder extends GifDecoder {
        SampledGifDecoder(Loader loader, int sample) {
            super(loader, null);
            sampleSize = sample;
        }

        @Override
        protected int getDesiredSample(int desiredWidth, int desiredHeight) {
            return sampleSize;
        }
    }

    /** Equivalent of the plugin's own resource wrapper, for decoders we build. */
    private static final class DecoderResource implements Resource<FrameSeqDecoder> {
        private final FrameSeqDecoder decoder;

        DecoderResource(FrameSeqDecoder decoder) {
            this.decoder = decoder;
        }

        @NonNull
        @Override
        public Class<FrameSeqDecoder> getResourceClass() {
            return FrameSeqDecoder.class;
        }

        @NonNull
        @Override
        public FrameSeqDecoder get() {
            return decoder;
        }

        @Override
        public int getSize() {
            // Only consulted before FrameDrawableTranscoder replaces this with a
            // Drawable resource sized by the decoder's own getMemorySize().
            return decoder.getMemorySize();
        }

        @Override
        public void recycle() {
            decoder.stop();
        }
    }
}
