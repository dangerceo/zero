package com.zero.android.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.DeviceHub
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.core.content.ContextCompat
import com.zero.android.service.MonitoringManager
import com.zero.android.util.normalizeBaseUrl

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    baseUrl: String?,
    monitoringEnabled: Boolean,
    onBaseUrlUpdate: (String) -> Unit,
    onClearBaseUrl: () -> Unit,
    onMonitoringToggle: (Boolean) -> Unit,
    onBack: () -> Unit,
    onRescan: () -> Unit,
    onWearables: () -> Unit
) {
    val context = LocalContext.current
    var baseUrlInput by remember(baseUrl) { mutableStateOf(baseUrl ?: "") }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            onMonitoringToggle(true)
            MonitoringManager.start(context)
        } else {
            errorMessage = "Notification permission is required for background monitoring."
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(text = "Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = onWearables) {
                        Icon(Icons.Default.DeviceHub, contentDescription = "Wearables")
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
                    Text(text = "Server URL", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = baseUrlInput,
                        onValueChange = { baseUrlInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("http://192.168.1.100:3847") }
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = {
                            val normalized = normalizeBaseUrl(baseUrlInput)
                            if (normalized == null) {
                                errorMessage = "Please enter a valid URL."
                            } else {
                                errorMessage = null
                                onBaseUrlUpdate(normalized)
                            }
                        }) {
                            Text(text = "Save")
                        }
                        Button(onClick = {
                            baseUrlInput = ""
                            onClearBaseUrl()
                            onRescan()
                        }) {
                            Text(text = "Clear")
                        }
                    }
                }
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(text = "Background Monitoring", style = MaterialTheme.typography.titleMedium)
                    Text(
                        text = "Keep project notifications updated while the app is in the background.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = if (monitoringEnabled) "Enabled" else "Disabled")
                        Switch(
                            checked = monitoringEnabled,
                            onCheckedChange = { enabled ->
                                if (enabled) {
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                        val granted = ContextCompat.checkSelfPermission(
                                            context,
                                            Manifest.permission.POST_NOTIFICATIONS
                                        ) == PackageManager.PERMISSION_GRANTED
                                        if (granted) {
                                            onMonitoringToggle(true)
                                            MonitoringManager.start(context)
                                        } else {
                                            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                        }
                                    } else {
                                        onMonitoringToggle(true)
                                        MonitoringManager.start(context)
                                    }
                                } else {
                                    onMonitoringToggle(false)
                                    MonitoringManager.stop(context)
                                }
                            }
                        )
                    }
                }
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(text = "Connection", style = MaterialTheme.typography.titleMedium)
                    Button(onClick = onRescan) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "Rescan QR")
                    }
                }
            }

            if (errorMessage != null) {
                Text(
                    text = errorMessage ?: "",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}
