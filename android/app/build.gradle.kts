plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android {
    namespace = "com.icristian7.runningsync"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.icristian7.runningsync"
        minSdk = 34
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.4")
    implementation("androidx.health.connect:connect-client:1.1.0")
}
