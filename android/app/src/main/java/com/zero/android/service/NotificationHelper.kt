package com.zero.android.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.RemoteInput
import com.zero.android.R

object NotificationHelper {
    const val CHANNEL_AGENTS = "agents_status"
    const val CHANNEL_ALERTS = "agents_alerts"
    const val GROUP_KEY = "zero_agents_group"
    const val ACTION_REPLY = "com.zero.android.ACTION_REPLY"
    const val KEY_TEXT_REPLY = "key_text_reply"
    const val EXTRA_AGENT_ID = "extra_agent_id"

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val agentsChannel = NotificationChannel(
                CHANNEL_AGENTS,
                context.getString(R.string.notification_channel_agents),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Background agent progress"
            }
            val alertsChannel = NotificationChannel(
                CHANNEL_ALERTS,
                context.getString(R.string.notification_channel_alerts),
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Agent status alerts"
            }
            manager.createNotificationChannel(agentsChannel)
            manager.createNotificationChannel(alertsChannel)
        }
    }

    fun buildServiceNotification(context: Context, activeCount: Int): Notification {
        return NotificationCompat.Builder(context, CHANNEL_AGENTS)
            .setSmallIcon(R.drawable.ic_stat_zero)
            .setContentTitle(context.getString(R.string.monitoring_active))
            .setContentText("Tracking $activeCount active project(s)")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    fun buildAgentNotification(
        context: Context,
        agentId: String,
        agentName: String,
        status: String,
        currentStep: String?,
        progress: Int,
        ongoing: Boolean,
        pendingIntent: PendingIntent?
    ): Notification {
        val content = currentStep?.takeIf { it.isNotBlank() } ?: status
        return NotificationCompat.Builder(context, CHANNEL_AGENTS)
            .setSmallIcon(R.drawable.ic_stat_zero)
            .setContentTitle(agentName)
            .setContentText(content)
            .setOnlyAlertOnce(true)
            .setGroup(GROUP_KEY)
            .setProgress(100, progress, false)
            .setOngoing(ongoing)
            .setContentIntent(pendingIntent)
            .build()
    }

    fun buildSummaryNotification(context: Context, count: Int): Notification {
        return NotificationCompat.Builder(context, CHANNEL_AGENTS)
            .setSmallIcon(R.drawable.ic_stat_zero)
            .setContentTitle("Zero Agents")
            .setContentText("$count project(s) updating")
            .setStyle(NotificationCompat.InboxStyle())
            .setGroup(GROUP_KEY)
            .setGroupSummary(true)
            .setOnlyAlertOnce(true)
            .build()
    }
}
