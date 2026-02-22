package com.zero.android

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.mutableStateOf
import com.zero.android.ui.MainViewModel
import com.zero.android.ui.MainViewModelFactory
import com.zero.android.ui.ZeroApp
import com.zero.android.ui.theme.ZeroTheme

class MainActivity : ComponentActivity() {
    private val viewModel: MainViewModel by viewModels {
        MainViewModelFactory((application as ZeroApplication).container)
    }

    private val agentIdFromIntent = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        agentIdFromIntent.value = intent.getStringExtra(EXTRA_AGENT_ID)

        setContent {
            ZeroTheme {
                ZeroApp(
                    viewModel = viewModel,
                    initialAgentId = agentIdFromIntent.value
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        agentIdFromIntent.value = intent.getStringExtra(EXTRA_AGENT_ID)
    }

    companion object {
        const val EXTRA_AGENT_ID = "extra_agent_id"
    }
}
