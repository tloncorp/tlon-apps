package io.tlon.landscape.images;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class AnimatedImageHeapGuardTest {
    /** ART's default per-process growth limit, and the one our devices report. */
    private static final long GROWTH_LIMIT = 256L * 1024L * 1024L;

    /** No particular size requested, e.g. {@code Target.SIZE_ORIGINAL}. */
    private static final int UNSPECIFIED = Integer.MIN_VALUE;

    private static long px(int side) {
        return (long) side * side;
    }

    private static int sample(int side, int target, long liveBytes) {
        return AnimatedImageHeapGuard.sampleFor(
                side, side, target, target, liveBytes, GROWTH_LIMIT);
    }

    @Test
    public void chargesTwelveBytesPerPixel() {
        // frameBuffer + snapShot.byteBuffer + GifWriter.intBuffer, 4 bytes each
        assertEquals(12L, AnimatedImageHeapGuard.heapCost(1));
        // the 1400x1400 GIF from REACT-NATIVE-15C
        assertEquals(23_520_000L, AnimatedImageHeapGuard.heapCost(px(1400)));
        // the 800x800 GIF measured at 7.36 MiB per decoder on device
        assertEquals(7_680_000L, AnimatedImageHeapGuard.heapCost(px(800)));
    }

    @Test
    public void samplingShrinksBothDimensions() {
        assertEquals(1_920_000L, AnimatedImageHeapGuard.heapCostAtSample(px(800), 2));
        assertEquals(480_000L, AnimatedImageHeapGuard.heapCostAtSample(px(800), 4));
    }

    /**
     * The measured case: an 800x800 avatar GIF in the three view sizes the app
     * actually renders avatars at. Full resolution costs 7.36 MiB apiece; these
     * bring it to ~30 KB, ~120 KB and ~120 KB.
     */
    @Test
    public void decodesAvatarsAtAvatarSize() {
        assertEquals(16, sample(800, 42, 0));
        assertEquals(8, sample(800, 95, 0));
        assertEquals(4, sample(800, 126, 0));
    }

    @Test
    public void decodesFullSizeWhenDrawnFullSize() {
        assertEquals(1, sample(800, 800, 0));
        assertEquals(1, sample(800, 1080, 0));
    }

    @Test
    public void fallsBackToTheBudgetWhenNoSizeIsRequested() {
        // 800x800 fits the per-image share on its own
        assertEquals(1, sample(800, UNSPECIFIED, 0));
        // 1400x1400 costs 23.5 MB against a ~12.8 MB share, so it halves
        assertEquals(2, AnimatedImageHeapGuard.sampleFor(
                1400, 1400, UNSPECIFIED, UNSPECIFIED, 0, GROWTH_LIMIT));
    }

    @Test
    public void downsamplesFurtherOnceLiveDecodersFillTheTotalShare() {
        long one = AnimatedImageHeapGuard.heapCost(px(800));
        // six full-size 800x800 decoders fit inside the ~51 MB total
        assertEquals(1, sample(800, UNSPECIFIED, one * 5));
        // the seventh would cross it, so it halves even though nothing about
        // the view asked it to
        assertEquals(2, sample(800, UNSPECIFIED, one * 6));
    }

    @Test
    public void neverUpsamples() {
        // a source smaller than its view is left alone
        assertEquals(1, sample(64, 128, 0));
    }

    @Test
    public void sharesScaleWithTheGrowthLimit() {
        assertEquals(2, AnimatedImageHeapGuard.sampleFor(
                1400, 1400, UNSPECIFIED, UNSPECIFIED, 0, GROWTH_LIMIT));
        // largeHeap doubles the limit, so it fits at full resolution
        assertEquals(1, AnimatedImageHeapGuard.sampleFor(
                1400, 1400, UNSPECIFIED, UNSPECIFIED, 0, 2 * GROWTH_LIMIT));
    }

    @Test
    public void stopsHalvingAtTheFloor() {
        assertEquals(16, sample(20000, 1, 0));
        assertEquals(16, sample(20000, UNSPECIFIED, Long.MAX_VALUE / 4));
    }
}
