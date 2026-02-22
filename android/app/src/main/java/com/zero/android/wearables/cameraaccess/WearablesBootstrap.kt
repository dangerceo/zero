package com.zero.android.wearables.cameraaccess

import android.content.Context
import com.meta.wearable.dat.core.Wearables

object WearablesBootstrap {
    @Volatile
    private var initialized = false

    fun ensureInitialized(context: Context) {
        if (!initialized) {
            Wearables.initialize(context.applicationContext)
            initialized = true
        }
    }
}
