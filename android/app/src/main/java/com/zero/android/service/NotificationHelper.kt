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
    const val ACTION_INTERVENE = "com.zero.android.ACTION_INTERVENE"
    const val KEY_TEXT_REPLY = "key_text_reply"
    const val EXTRA_AGENT_ID = "extra_agent_id"
    const val EXTRA_INTERVENTION_ID = "extra_intervention_id"
    const val EXTRA_RESPONSE_VALUE = "extra_response_value"

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
        val builder = NotificationCompat.Builder(context, CHANNEL_AGENTS)
            .setSmallIcon(R.drawable.ic_stat_zero)
            .setContentTitle(agentName)
            .setContentText(content)
            .setOnlyAlertOnce(true)
            .setGroup(GROUP_KEY)
            .setProgress(100, progress, false)
            .setOngoing(ongoing)
            .setContentIntent(pendingIntent)

        // Add Quick Reply action
        val remoteInput = RemoteInput.Builder(KEY_TEXT_REPLY)
            .setLabel("Reply to agent...")
            .build()

        val replyIntent = Intent(context, QuickReplyReceiver::class.java).apply {
            action = ACTION_REPLY
            putExtra(EXTRA_AGENT_ID, agentId)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val replyPendingIntent = PendingIntent.getBroadcast(
            context,
            agentId.hashCode(),
            replyIntent,
            flags
        )

        val action = NotificationCompat.Action.Builder(
            R.drawable.ic_reply,
            "Quick Reply",
            replyPendingIntent
        ).addRemoteInput(remoteInput).build()

        builder.addAction(action)

        return builder.build()
    }

    fun buildInterventionNotification(
        context: Context,
        agentId: String,
        agentName: String,
        interventionId: String,
        message: String,
        type: String,
        options: List<Pair<String, String>>, // label, value
        pendingIntent: PendingIntent?
    ): Notification {
        val builder = NotificationCompat.Builder(context, CHANNEL_ALERTS)
            .setSmallIcon(R.drawable.ic_stat_zero)
            .setContentTitle(agentName)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOnlyAlertOnce(true)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        if (type == "input" || type == "confirm") {
            val remoteInput = RemoteInput.Builder(KEY_TEXT_REPLY)
                .setLabel(if (type == "confirm") "Confirm (Yes/No)" else "Reply...")
                .build()

            val replyIntent = Intent(context, QuickReplyReceiver::class.java).apply {
                action = ACTION_INTERVENE
                putExtra(EXTRA_AGENT_ID, agentId)
                putExtra(EXTRA_INTERVENTION_ID, interventionId)
            }

            val replyPendingIntent = PendingIntent.getBroadcast(
                context,
                interventionId.hashCode(),
                replyIntent,
                flags
            )

            val action = NotificationCompat.Action.Builder(
                R.drawable.ic_reply,
                "Reply",
                replyPendingIntent
            ).addRemoteInput(remoteInput).build()

            builder.addAction(action)
        }

        if (type == "choice" || type == "confirm") {
            val actualOptions = if (type == "confirm") {
                listOf("Yes" to "yes", "No" to "no")
            } else options

            actualOptions.take(3).forEachIndexed { index, (label, value) ->
                val actionIntent = Intent(context, QuickActionReceiver::class.java).apply {
                    action = ACTION_INTERVENE + "_" + index
                    putExtra(EXTRA_AGENT_ID, agentId)
                    putExtra(EXTRA_INTERVENTION_ID, interventionId)
                    putExtra(EXTRA_RESPONSE_VALUE, value)
                }

                val actionPendingIntent = PendingIntent.getBroadcast(
                    context,
                    (interventionId + value).hashCode(),
                    actionIntent,
                    flags
                )

                val action = NotificationCompat.Action.Builder(
                    0, // Icons not required for simple buttons
                    label,
                    actionPendingIntent
                ).build()
                builder.addAction(action)
            }
        }

        return builder.build()
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
