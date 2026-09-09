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
 * Decodes animated images at the size they will actually be drawn at, and
 * bounds what they can cost us on the Java heap in aggregate. See TLON-6505.
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
 * <p>What a heap dump showed: an animated GIF used as somebody's <b>profile
 * avatar</b> was live in sixteen views at once — 42x42, 95x95 and 126x126 px,
 * one per message row — and every one of them had decoded the full 800x800
 * source. 7.36 MiB of Java heap to fill a 42x42 avatar, a ~366x overshoot,
 * sixteen times over, for 118 MiB. Glide had asked for the right size every
 * time; the plugin's {@code decode(source, width, height, options)} simply
 * never reads its width and height arguments, and {@code
 * GifDecoder.getDesiredSample} hardcodes 1, so even {@code setDesiredSize}
 * cannot help. At the 1400x1400 seen in production that is 22.4 MiB per row,
 * and eleven rows is the whole 256 MB limit.
 *
 * <p>So for GIF we build the decoder ourselves with {@code sampleSize} preset:
 * enough to bring the decode down to the size Glide asked for, and increased
 * further if needed to keep this animation inside a per-image share of the
 * growth limit and every live animation together inside a larger share. The
 * shares scale off {@code maxMemory}, so they track {@code largeHeap} and
 * future devices. Everything else is left to the plugin.
 *
 * <p>Two details worth keeping:
 *
 * <ul>
 *   <li>Presetting the field is necessary. {@code setDesiredSize} works through
 *       {@code getDesiredSample}, whose base implementation calls {@code
 *       getBounds()} and so triggers a full-resolution parse and allocation
 *       before the smaller size could take effect.
 *   <li>Declining a decode does <em>not</em> fall through to Glide's static
 *       decoders. {@code Registry.prepend} cannot unregister the plugin's own
 *       decoder for the same pair, so whatever we refuse it decodes unguarded.
 *       A guard here has to return a cheaper decoder, not refuse to make one.
 * </ul>
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
     * Power-of-two sample size to decode at: enough to bring a
     * {@code width x height} source down to a {@code targetWidth x targetHeight}
     * view, then increased further if that still wouldn't fit this animation
     * inside its own share of {@code growthLimit} or keep the total, including
     * {@code liveBytes} already held, inside the larger share. Never exceeds
     * {@link #MAX_SAMPLE_SIZE}.
     *
     * <p>A non-positive target means Glide didn't ask for a particular size
     * (e.g. {@code Target.SIZE_ORIGINAL}), in which case only the budget
     * constrains us.
     */
    static int sampleFor(
            int width,
            int height,
            int targetWidth,
            int targetHeight,
            long liveBytes,
            long growthLimit) {
        int sample = sampleForTarget(width, height, targetWidth, targetHeight);
        long pixels = (long) width * height;
        long perImage = growthLimit / PER_IMAGE_DIVISOR;
        long total = growthLimit / TOTAL_DIVISOR;
        while (sample < MAX_SAMPLE_SIZE) {
            long cost = heapCostAtSample(pixels, sample);
            if (cost <= perImage && liveBytes + cost <= total) {
                break;
            }
            sample *= 2;
        }
        return sample;
    }

    /** The plugin's own halving rule, which its GIF decoder never applies. */
    private static int sampleForTarget(
            int width, int height, int targetWidth, int targetHeight) {
        if (targetWidth <= 0 || targetHeight <= 0) {
            return 1;
        }
        int ratio = Math.min(width / targetWidth, height / targetHeight);
        int sample = 1;
        while (sample * 2 <= ratio && sample < MAX_SAMPLE_SIZE) {
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

    /** {@code {width, height}} from the header alone, or null if unreported. */
    @Nullable
    private static int[] measure(ByteBuffer source) {
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
            return null;
        }
        return new int[] {bounds.outWidth, bounds.outHeight};
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
            int[] size = measure(source);
            // Unknown dimensions (e.g. AVIF below API 31), or a format we don't
            // take over: leave it to the plugin rather than guessing.
            if (size == null || !isGif(source)) {
                long pixels = size == null ? -1 : (long) size[0] * size[1];
                return trackIfKnown(delegate.decode(source, width, height, options), pixels, 1);
            }
            long pixels = (long) size[0] * size[1];
            int sample;
            synchronized (LIVE) {
                sample =
                        sampleFor(
                                size[0],
                                size[1],
                                width,
                                height,
                                liveHeapBytes(),
                                Runtime.getRuntime().maxMemory());
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
