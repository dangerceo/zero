package com.zero.android.ui.screens

import android.content.pm.PackageManager
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WearablesScreen(
    onBack: () -> Unit,
    onCameraAccess: () -> Unit,
) {
    val context = LocalContext.current
    val appId = remember {
        try {
            val appInfo = context.packageManager.getApplicationInfo(
                context.packageName,
                PackageManager.GET_META_DATA
            )
            appInfo.metaData?.getString("com.meta.wearable.mwdat.APPLICATION_ID")
        } catch (_: Exception) {
            null
        }
    }
    val clientToken = remember {
        try {
            val appInfo = context.packageManager.getApplicationInfo(
                context.packageName,
                PackageManager.GET_META_DATA
            )
            appInfo.metaData?.getString("com.meta.wearable.mwdat.CLIENT_TOKEN")
        } catch (_: Exception) {
            null
        }
    }
    var mockEnabled by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(text = "Wearables") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "Meta Wearables DAT", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = if (!appId.isNullOrBlank()) "SDK ready" else "Missing Application ID",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    if (!appId.isNullOrBlank()) {
                        Text(
                            text = "App ID: $appId",
                            style = MaterialTheme.typography.labelMedium
                        )
                    } else {
                        Text(
                            text = "Set dat_application_id in local.properties or DAT_APPLICATION_ID env var.",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = if (!clientToken.isNullOrBlank()) {
                            val tail = clientToken.takeLast(4)
                            "Client token: ••••$tail"
                        } else {
                            "Client token missing"
                        },
                        style = MaterialTheme.typography.labelMedium,
                        color = if (!clientToken.isNullOrBlank()) {
                            MaterialTheme.colorScheme.onSurface
                        } else {
                            MaterialTheme.colorScheme.error
                        }
                    )
                    if (clientToken.isNullOrBlank()) {
                        Text(
                            text = "Set dat_client_token in local.properties or DAT_CLIENT_TOKEN env var.",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "Mock Device", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = if (mockEnabled) "Enabled" else "Disabled")
                        Switch(
                            checked = mockEnabled,
                            onCheckedChange = { mockEnabled = it }
                        )
                    }
                    Text(
                        text = "This is a placeholder. Device connection is out of scope for MVP.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "Camera Access", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Preview the Meta Wearables DAT camera access experience.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedButton(onClick = onCameraAccess) {
                        Text(text = "Open Camera Access")
                    }
                }
            }
        }
    }
}
