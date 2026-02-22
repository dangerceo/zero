package com.zero.android.service

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

object MonitoringManager {
    fun start(context: Context) {
        val intent = Intent(context, MonitoringService::class.java).apply {
            action = MonitoringService.ACTION_START
        }
        ContextCompat.startForegroundService(context, intent)
    }

    fun stop(context: Context) {
        val intent = Intent(context, MonitoringService::class.java).apply {
            action = MonitoringService.ACTION_STOP
        }
        context.stopService(intent)
    }
}
