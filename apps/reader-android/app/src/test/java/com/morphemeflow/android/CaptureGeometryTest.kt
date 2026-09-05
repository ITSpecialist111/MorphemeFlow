package com.morphemeflow.android

import org.junit.Assert.*
import org.junit.Test

class CaptureGeometryTest {
    @Test fun bandStaysInsidePortraitLandscapeAndFoldableDisplays() {
        for ((width, height) in listOf(1080 to 2400, 2400 to 1080, 2208 to 1840)) {
            for (center in listOf(-1f, 0f, 0.45f, 1f, 2f, Float.NaN)) {
                val band = CaptureGeometry.band(width, height, center, 100, 3f)
                assertEquals(width, band.width)
                assertEquals(300, band.height)
                assertTrue(band.top >= 0 && band.bottom <= height)
            }
        }
    }

    @Test fun rotationDuringCaptureIsRejected() {
        val band = CaptureGeometry.band(1080, 2400, 0.5f, 100, 3f)
        assertNull(CaptureGeometry.checkedCrop(band, 1080, 2400, 2400, 1080))
        assertEquals(band, CaptureGeometry.checkedCrop(band, 1080, 2400, 1080, 2400))
    }

    @Test fun invalidAndOutOfBoundsCropsAreRejected() {
        for (region in listOf(ScreenRegion(-1, 0, 100, 100), ScreenRegion(0, 0, 2000, 100), ScreenRegion(0, 0, 0, 0))) {
            assertNull(CaptureGeometry.checkedCrop(region, 1080, 2400, 1080, 2400))
        }
    }

    @Test fun lensDoesNotCoverTheChosenBand() {
        for (center in listOf(0.1f, 0.5f, 0.9f)) {
            val band = CaptureGeometry.band(1080, 2400, center, 100, 3f)
            val top = CaptureGeometry.lensTop(band, 2400, 600, 24)
            assertTrue(top >= band.bottom || top + 600 <= band.top)
        }
    }

    @Test fun invalidPreferencesStillProduceABoundedBand() {
        val band = CaptureGeometry.band(320, 480, Float.NaN, Int.MAX_VALUE, Float.NaN)
        assertEquals(320, band.height)
        assertTrue(band.top >= 0 && band.bottom <= 480)
    }

    @Test fun tallBandShrinksLensInsteadOfCoveringSource() {
        val source = ScreenRegion(0, 200, 360, 520)
        val height = CaptureGeometry.lensHeight(source, 800, 300, 8)
        val top = CaptureGeometry.lensTop(source, 800, height, 8)
        assertEquals(272, height)
        assertTrue(top >= source.bottom || top + height <= source.top)
        assertEquals(0, CaptureGeometry.lensHeight(ScreenRegion(0, 0, 360, 800), 800, 300, 8))
    }
}