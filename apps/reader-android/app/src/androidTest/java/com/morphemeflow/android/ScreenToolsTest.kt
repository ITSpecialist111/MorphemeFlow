package com.morphemeflow.android

import android.app.UiAutomation
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Configurator
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class ScreenToolsTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.targetContext
    private lateinit var device: UiDevice
    private var previousServices: String? = null
    private var previousEnabled = 0

    @Before fun enableServiceOnTestDevice() {
        Configurator.getInstance().uiAutomationFlags = UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES
        device = UiDevice.getInstance(instrumentation)
        device.wakeUp()
        device.executeShellCommand("wm dismiss-keyguard")
        context.startActivity(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        assertTrue("Reader input did not appear", device.wait(Until.hasObject(By.desc("Text to read")), 30_000))
        previousServices = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
        previousEnabled = Settings.Secure.getInt(context.contentResolver, Settings.Secure.ACCESSIBILITY_ENABLED, 0)
        val service = ComponentName(context, ReadingService::class.java).flattenToString()
        val services = (previousServices?.split(":").orEmpty() + service).filter { it.isNotBlank() }.distinct().joinToString(":")
        ReaderPreferences().save(context)
        setAccessibilitySettings(services, 1)
        instrumentation.runOnMainSync { ReadingService.current?.showTools() }
        device.wakeUp()
        device.pressHome()
        assertTrue("Accessibility overlay did not connect", device.wait(Until.hasObject(By.desc("Read screen band")), 15_000))
    }

    @After fun restoreAccessibilitySettings() {
        device.unfreezeRotation()
        instrumentation.runOnMainSync { ReadingService.current?.stopTools() }
        setAccessibilitySettings(previousServices, previousEnabled)
        device.pressHome()
    }

    private fun setAccessibilitySettings(services: String?, enabled: Int) {
        val automation = instrumentation.getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES)
        automation.adoptShellPermissionIdentity("android.permission.WRITE_SECURE_SETTINGS")
        try {
            Settings.Secure.putString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, services)
            Settings.Secure.putInt(context.contentResolver, Settings.Secure.ACCESSIBILITY_ENABLED, enabled)
        } finally {
            automation.dropShellPermissionIdentity()
        }
    }

    private fun launchFixture(secure: Boolean = false) {
        val intent = Intent().setComponent(ComponentName(instrumentation.context.packageName, ScreenFixtureActivity::class.java.name))
            .putExtra("secure", secure).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        context.startActivity(intent)
        assertTrue(device.wait(Until.hasObject(By.text("Reading independently")), 10_000))
        device.waitForIdle()
    }

    @Test fun overlayPassesTouchesAndRecognizesTheChosenTextOffline() {
        @Suppress("DEPRECATION")
        val permissions = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS).requestedPermissions.orEmpty()
        assertFalse("APK must not have Internet permission", permissions.contains("android.permission.INTERNET"))
        launchFixture()
        device.findObject(By.text("Clicks: 0")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Clicks: 1")), 2_000))
        device.findObject(By.desc("Read screen band")).click()
        assertTrue("OCR lens did not appear", device.wait(Until.hasObject(By.desc("Close reading lens")), 15_000))
        assertTrue("Bundled reader did not render", device.wait(Until.hasObject(By.text("Screen OCR snapshot")), 10_000))
        var captured: String? = null
        instrumentation.runOnMainSync { captured = ReadingService.current?.capturedText }
        assertEquals("Reading independently", captured)
        device.takeScreenshot(File(context.getExternalFilesDir(null), "android-screen-lens.png"))
        device.findObject(By.desc("Close reading lens")).click()
        instrumentation.runOnMainSync { captured = ReadingService.current?.capturedText }
        assertEquals("", captured)
        device.findObject(By.desc("Turn off screen tools")).click()
        assertTrue(device.wait(Until.gone(By.desc("Read screen band")), 2_000))
    }

    @Test fun protectedScreenNeverProducesAReadingSnapshot() {
        launchFixture(secure = true)
        device.findObject(By.desc("Read screen band")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Read screen band")), 15_000))
        assertFalse(device.hasObject(By.desc("Close reading lens")))
        var captured: String? = null
        instrumentation.runOnMainSync { captured = ReadingService.current?.capturedText }
        assertEquals("", captured)
    }

    @Test fun sharedTextWorksWithoutScreenCapture() {
        instrumentation.runOnMainSync { ReadingService.current?.stopTools() }
        context.startActivity(Intent(context, MainActivity::class.java)
            .setAction(Intent.ACTION_SEND).setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, "Unhappiness and understanding.\nExact source text.")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        assertTrue(device.wait(Until.hasObject(By.text("Shared text")), 10_000))
        assertTrue(device.wait(Until.hasObject(By.desc("Clear text")), 5_000))
        device.takeScreenshot(File(context.getExternalFilesDir(null), "android-shared-reader.png"))
        device.findObject(By.desc("Clear text")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Text to read")), 3_000))
    }

    @Test fun rotatingReaderKeepsThePassageInMemory() {
        instrumentation.runOnMainSync { ReadingService.current?.stopTools() }
        context.startActivity(Intent(context, MainActivity::class.java)
            .setAction(Intent.ACTION_SEND).setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, "Reading independently")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        assertTrue(device.wait(Until.hasObject(By.text("Shared text")), 10_000))
        device.setOrientationLeft()
        device.waitForIdle()
        assertTrue("Reading passage was lost during rotation", device.wait(Until.hasObject(By.text("Shared text")), 10_000))
        assertFalse(device.hasObject(By.desc("Text to read")))
        device.takeScreenshot(File(context.getExternalFilesDir(null), "android-reader-landscape.png"))
        device.findObject(By.desc("Clear text")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Text to read")), 3_000))
    }
}