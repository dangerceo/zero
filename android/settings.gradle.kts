import java.util.Properties

val localProps = Properties()
val localPropsFile = file("local.properties")
if (localPropsFile.exists()) {
    localPropsFile.inputStream().use { localProps.load(it) }
}

val githubToken = (localProps.getProperty("github_token")
    ?: System.getenv("GITHUB_TOKEN")
    ?: "")

val datApplicationId = (localProps.getProperty("dat_application_id")
    ?: System.getenv("DAT_APPLICATION_ID")
    ?: "")

val datClientToken = (localProps.getProperty("dat_client_token")
    ?: System.getenv("DAT_CLIENT_TOKEN")
    ?: "")

gradle.extra["githubToken"] = githubToken
gradle.extra["datApplicationId"] = datApplicationId
gradle.extra["datClientToken"] = datClientToken

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven {
            url = uri("https://maven.pkg.github.com/facebook/meta-wearables-dat-android")
            credentials {
                username = "github"
                password = githubToken
            }
        }
    }
}

rootProject.name = "ZeroAndroid"
include(":app")
