package com.zero.android

import android.app.Application
import com.zero.android.data.AppContainer

class ZeroApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
