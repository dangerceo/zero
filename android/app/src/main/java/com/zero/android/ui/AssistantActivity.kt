package com.zero.android.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.ViewModelProvider
import com.zero.android.ZeroApplication
import com.zero.android.ui.theme.ZeroTheme

class AssistantActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val appContainer = (application as ZeroApplication).container
        val viewModel = ViewModelProvider(
            this, 
            MainViewModelFactory(appContainer)
        )[MainViewModel::class.java]

        setContent {
            ZeroTheme {
                // We can pass a specific initial route or mode here if we want
                // For now, let's open the Tasks screen directly as it's most relevant for "Assistant" actions
                ZeroApp(viewModel = viewModel, initialAgentId = null, isAssistantMode = true)
            }
        }
    }
}
