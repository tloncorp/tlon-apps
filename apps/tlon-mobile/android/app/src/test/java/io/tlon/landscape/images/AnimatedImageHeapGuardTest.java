package io.tlon.landscape.images;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class AnimatedImageHeapGuardTest {
    /** ART's default per-process growth limit, and the one our devices report. */
    private static final long GROWTH_LIMIT = 256L * 1024L * 1024L;

    private static long px(int side) {
        return (long) side * side;
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

    @Test
    public void leavesSmallAnimationsAlone() {
        assertEquals(1, AnimatedImageHeapGuard.sampleFor(px(800), 0, GROWTH_LIMIT));
        assertEquals(1, AnimatedImageHeapGuard.sampleFor(px(1024), 0, GROWTH_LIMIT));
    }

    @Test
    public void downsamplesPastThePerImageShare() {
        // 1400x1400 costs 23.5 MB against a ~12.8 MB per-image share
        assertEquals(2, AnimatedImageHeapGuard.sampleFor(px(1400), 0, GROWTH_LIMIT));
        // 4000x4000 costs 192 MB, so it needs a deeper reduction
        assertEquals(4, AnimatedImageHeapGuard.sampleFor(px(4000), 0, GROWTH_LIMIT));
    }

    @Test
    public void downsamplesOnceLiveDecodersFillTheTotalShare() {
        long one = AnimatedImageHeapGuard.heapCost(px(800));
        // six of the measured 800x800 decoders fit inside the ~51 MB total
        assertEquals(1, AnimatedImageHeapGuard.sampleFor(px(800), one * 5, GROWTH_LIMIT));
        // the seventh would cross it, so it decodes at half size instead. On
        // device, sixteen of these were live at once for a single image.
        assertEquals(2, AnimatedImageHeapGuard.sampleFor(px(800), one * 6, GROWTH_LIMIT));
    }

    @Test
    public void sharesScaleWithTheGrowthLimit() {
        // largeHeap doubles the limit, so 1400x1400 fits at full resolution
        assertEquals(2, AnimatedImageHeapGuard.sampleFor(px(1400), 0, GROWTH_LIMIT));
        assertEquals(1, AnimatedImageHeapGuard.sampleFor(px(1400), 0, 2 * GROWTH_LIMIT));
    }

    @Test
    public void stopsHalvingAtTheFloor() {
        assertEquals(16, AnimatedImageHeapGuard.sampleFor(px(20000), Long.MAX_VALUE / 4, GROWTH_LIMIT));
    }
}
