package com.zero.android.service

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.zero.android.ZeroApplication
import com.zero.android.data.remote.AgentsApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class ZeroNotificationListenerService : NotificationListenerService() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName
        val extras = sbn.notification.extras
        val title = extras.getString(Notification.EXTRA_TITLE) ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""

        val highSignalApps = listOf("messaging", "whatsapp", "eufy", "security")
        
        if (highSignalApps.any { packageName.contains(it, true) } || title.contains("Security", true)) {
            syncToServer(packageName, title, text)
        }
    }

    private fun syncToServer(app: String, title: String, text: String) {
        val zeroApp = applicationContext as ZeroApplication
        serviceScope.launch {
            try {
                val url = zeroApp.container.userPreferences.baseUrlFlow.firstOrNull() ?: return@launch
                val api = Retrofit.Builder()
                    .baseUrl(url)
                    .client(zeroApp.container.okHttpClient)
                    .addConverterFactory(MoshiConverterFactory.create(zeroApp.container.moshi))
                    .build()
                    .create(AgentsApi::class.java)

                val payload = mapOf(
                    "app" to app.split(".").last().uppercase(),
                    "title" to title,
                    "text" to text
                )
                api.syncNotification(payload)
            } catch (_: Exception) {}
        }
    }
}
