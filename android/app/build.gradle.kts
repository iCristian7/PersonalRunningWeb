plugins { id("com.android.application"); id("org.jetbrains.kotlin.android"); id("kotlin-parcelize") }

android {
    namespace = "com.icristian7.runningsync"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.icristian7.runningsync"
        minSdk = 34
        targetSdk = 35
        versionCode = 4
        versionName = "0.4.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { dataBinding = true }
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    implementation(files("libs/samsung-health-data-api-1.1.0.aar"))
    implementation("com.google.code.gson:gson:2.13.2")
    testImplementation("junit:junit:4.13.2")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.4")
    implementation("androidx.health.connect:connect-client:1.1.0")
}
