package com.zero.android.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.zero.android.data.model.AgentUiModel
import com.zero.android.data.model.AgyProject
import com.zero.android.data.model.ChatProject
import com.zero.android.service.MonitoringManager
import com.zero.android.util.normalizeBaseUrl

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    baseUrl: String?,
    monitoringEnabled: Boolean,
    agents: List<AgentUiModel>,
    agyProjects: List<AgyProject>,
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
    var expandedLogId by remember { mutableStateOf<String?>(null) }

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

            Spacer(modifier = Modifier.height(24.dp))
            Text(text = "Dev Dashboard", style = MaterialTheme.typography.headlineSmall)
            
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Card(modifier = Modifier.weight(1f)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(text = "${agents.size + agyProjects.size}", style = MaterialTheme.typography.headlineMedium)
                        Text(text = "Total Projects", style = MaterialTheme.typography.labelMedium)
                    }
                }
                Card(modifier = Modifier.weight(1f)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        val totalLogs = agents.sumOf { it.logs.size } + agyProjects.sumOf { it.logs.size }
                        Text(text = "$totalLogs", style = MaterialTheme.typography.headlineMedium)
                        Text(text = "Action Logs", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }

            Text(text = "Active Inspectors", style = MaterialTheme.typography.titleMedium)
            
            val allProjects = remember(agents, agyProjects) {
                agents.map { ChatProject(it.id, it.name, it.status, it.logs, it.threads) } + 
                agyProjects.map { ChatProject(it.id, it.name, it.status, it.logs, it.threads) }
            }

            allProjects.forEach { p ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(text = p.name, style = MaterialTheme.typography.titleMedium)
                                Text(text = p.id, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (p.id.startsWith("gemini-") || p.id.startsWith("agy-")) {
                                    Button(onClick = {
                                        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("http://10.0.0.141:3000"))
                                        context.startActivity(intent)
                                    }) {
                                        Text("Preview")
                                    }
                                }
                                Button(onClick = { expandedLogId = if (expandedLogId == p.id) null else p.id }) {
                                    Text("Logs")
                                }
                            }
                        }
                        
                        AnimatedVisibility(visible = expandedLogId == p.id) {
                            Column {
                                Spacer(modifier = Modifier.height(16.dp))
                                Text(text = "Logs", style = MaterialTheme.typography.titleSmall)
                                Spacer(modifier = Modifier.height(8.dp))
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = androidx.compose.material3.CardDefaults.cardColors(
                                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                                    )
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .padding(12.dp)
                                            .height(200.dp)
                                    ) {
                                        LazyColumn {
                                            items(p.logs) { log ->
                                                Text(
                                                    text = "> ${log.message}",
                                                    style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                                                    modifier = Modifier.padding(vertical = 2.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}
