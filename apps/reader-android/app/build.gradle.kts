plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.morphemeflow.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.morphemeflow.android"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/readerAssets"))
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("com.google.mlkit:text-recognition:16.0.1")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.uiautomator:uiautomator:2.3.0")
}

val stageReaderAssets by tasks.registering(Exec::class) {
    workingDir(rootProject.projectDir.resolve("../.."))
    commandLine("node", "apps/reader-android/build-assets.mjs")
    inputs.dir(rootProject.projectDir.resolve("ui"))
    inputs.file(rootProject.projectDir.resolve("build-assets.mjs"))
    inputs.dir(rootProject.projectDir.resolve("../../packages/engine-ts/src"))
    inputs.dir(rootProject.projectDir.resolve("../../packages/engine-ts/data"))
    inputs.dir(rootProject.projectDir.resolve("../reader-windows/ui"))
    inputs.dir(rootProject.projectDir.resolve("../../public/fonts"))
    outputs.dir(layout.buildDirectory.dir("generated/readerAssets"))
}
tasks.named("preBuild") { dependsOn(stageReaderAssets) }