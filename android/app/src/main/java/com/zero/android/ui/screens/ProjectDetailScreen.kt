package com.zero.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zero.android.data.model.AgentUiModel
import com.zero.android.ui.components.LogEntry
import com.zero.android.ui.components.LogList

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectDetailScreen(
    agentId: String?,
    agents: List<AgentUiModel>,
    onBack: () -> Unit
) {
    val agent = agents.firstOrNull { it.id == agentId }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(text = agent?.name ?: "Agent") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        if (agent == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "Agent not found", style = MaterialTheme.typography.bodyLarge)
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                AgentHeader(agent)
                Card(
                    modifier = Modifier.fillMaxSize(),
                    shape = MaterialTheme.shapes.large,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(text = "Logs", style = MaterialTheme.typography.titleMedium)
                        Spacer(modifier = Modifier.height(8.dp))
                        LogList(
                            logs = agent.logs.map {
                                LogEntry(
                                    message = it.message,
                                    type = it.type,
                                    timestamp = it.timestamp
                                )
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AgentHeader(agent: AgentUiModel) {
    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = agent.name,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                StatusPill(agent.status)
                Spacer(modifier = Modifier.size(12.dp))
                if (!agent.currentStep.isNullOrBlank()) {
                    Text(
                        text = agent.currentStep,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )
                }
            }
            if (agent.progress > 0) {
                Spacer(modifier = Modifier.height(10.dp))
                androidx.compose.material3.LinearProgressIndicator(
                    progress = agent.progress / 100f,
                    modifier = Modifier.fillMaxWidth(),
                    color = Color(0xFF1AAE8A)
                )
            }
        }
    }
}

@Composable
private fun StatusPill(status: String) {
    val color = when (status.lowercase()) {
        "working" -> Color(0xFF1AAE8A)
        "completed" -> Color(0xFF2ECC71)
        "failed" -> Color(0xFFD94A4A)
        "waiting" -> Color(0xFFE6A23C)
        else -> MaterialTheme.colorScheme.primary
    }

    Box(
        modifier = Modifier
            .background(color.copy(alpha = 0.15f), shape = MaterialTheme.shapes.small)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = status.replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.labelMedium,
            color = color,
            fontWeight = FontWeight.Medium
        )
    }
}
