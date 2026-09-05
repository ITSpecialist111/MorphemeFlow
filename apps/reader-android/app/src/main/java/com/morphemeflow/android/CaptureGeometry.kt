package com.morphemeflow.android

import kotlin.math.roundToInt

data class ScreenRegion(val left: Int, val top: Int, val right: Int, val bottom: Int) {
    val width: Int get() = right - left
    val height: Int get() = bottom - top
}

object CaptureGeometry {
    fun band(width: Int, height: Int, center: Float, bandDp: Int, density: Float): ScreenRegion {
        require(width > 0 && height > 0)
        val safeDensity = density.takeIf { it.isFinite() && it > 0f } ?: 1f
        val bandHeight = (bandDp.coerceIn(40, 320) * safeDensity).roundToInt().coerceIn(1, height)
        val fraction = center.takeIf { it.isFinite() }?.coerceIn(0f, 1f) ?: 0.45f
        val top = (height * fraction - bandHeight / 2f).roundToInt().coerceIn(0, height - bandHeight)
        return ScreenRegion(0, top, width, top + bandHeight)
    }

    fun checkedCrop(region: ScreenRegion, surfaceWidth: Int, surfaceHeight: Int, bitmapWidth: Int, bitmapHeight: Int): ScreenRegion? {
        if (surfaceWidth != bitmapWidth || surfaceHeight != bitmapHeight) return null
        if (region.left < 0 || region.top < 0 || region.right > bitmapWidth || region.bottom > bitmapHeight) return null
        return region.takeIf { it.width > 0 && it.height > 0 }
    }

    fun lensTop(source: ScreenRegion, displayHeight: Int, lensHeight: Int, gap: Int): Int {
        val height = lensHeight.coerceIn(1, displayHeight)
        val below = source.bottom + gap
        return (if (below + height <= displayHeight) below else source.top - height - gap)
            .coerceIn(0, displayHeight - height)
    }

    fun lensHeight(source: ScreenRegion, displayHeight: Int, requestedHeight: Int, gap: Int): Int =
        requestedHeight.coerceAtMost(maxOf(source.top - gap, displayHeight - source.bottom - gap).coerceAtLeast(0))
}