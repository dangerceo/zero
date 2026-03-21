package com.zero.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.Text
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zero.android.data.model.ConnectionState
import com.zero.android.data.model.AgentUiModel
import com.zero.android.data.model.AgyProject
import com.zero.android.ui.components.BottomNavBar
import com.zero.android.ui.components.BottomTab

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectsScreen(
    agents: List<AgentUiModel>,
    agyProjects: List<AgyProject>,
    connectionState: ConnectionState,
    onRefresh: () -> Unit,
    onSettings: () -> Unit,
    onWearables: () -> Unit,
    onInbox: () -> Unit,
    onTasks: () -> Unit,
    onAgentSelected: (String) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(text = "zero", style = MaterialTheme.typography.titleMedium)
                        ConnectionBadge(connectionState)
                    }
                },
                actions = {
                    IconButton(onClick = onRefresh) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                    IconButton(onClick = onSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                }
            )
        },
        bottomBar = {
            BottomNavBar(
                current = BottomTab.Projects,
                onProjects = {},
                onInbox = onInbox,
                onTasks = onTasks,
                onCamera = onWearables
            )
        }
    ) { padding ->
        Box(modifier = Modifier
            .fillMaxSize()
            .padding(padding)) {
            if (agents.isEmpty() && agyProjects.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "No active projects", style = MaterialTheme.typography.bodyLarge)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp)
                ) {
                    if (agents.isNotEmpty()) {
                        item {
                            Text(
                                text = "zero agents",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )
                        }
                        items(agents, key = { it.id }) { agent ->
                            AgentCard(agent = agent, onClick = { onAgentSelected(agent.id) })
                        }
                    }

                    val geminiCloud = agyProjects.filter { it.type.startsWith("gemini-") }
                    if (geminiCloud.isNotEmpty()) {
                        item {
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "gemini cloud projects",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )
                        }
                        items(geminiCloud, key = { it.id }) { project ->
                            AgyProjectCard(project = project, onClick = { onAgentSelected(project.id) })
                        }
                    }

                    val editorProjects = agyProjects.filter { !it.type.startsWith("gemini-") }
                    if (editorProjects.isNotEmpty()) {
                        item {
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "agy (remote editor)",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )
                        }
                        items(editorProjects, key = { it.id }) { project ->
                            AgyProjectCard(project = project, onClick = { onAgentSelected(project.id) })
                        }
                    }
                }
            }
        }
    }
}

private val ZeroSecondary = Color(0xFF6200EE)

@Composable
private fun ConnectionBadge(state: ConnectionState) {
    val (label, color) = when (state) {
        ConnectionState.Connected -> "Connected" to ZeroSecondary
        ConnectionState.Connecting -> "Connecting" to Color(0xFFE6A23C)
        ConnectionState.Disconnected -> "Disconnected" to Color(0xFFD94A4A)
    }

    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(RoundedCornerShape(50))
                .background(color)
        )
        Spacer(modifier = Modifier.size(6.dp))
        Text(text = label, style = MaterialTheme.typography.labelMedium, color = color)
    }
}

@Composable
private fun AgentCard(agent: AgentUiModel, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = agent.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f)
                )
                StatusChip(status = agent.status)
            }
            Spacer(modifier = Modifier.height(8.dp))
            agent.currentStep?.takeIf { it.isNotBlank() }?.let { step ->
                Text(
                    text = step,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )
            }
            if (agent.progress > 0) {
                Spacer(modifier = Modifier.height(8.dp))
                androidx.compose.material3.LinearProgressIndicator(
                    progress = agent.progress / 100f,
                    modifier = Modifier.fillMaxWidth(),
                    color = ZeroSecondary
                )
            }
        }
    }
}

@Composable
private fun AgyProjectCard(project: AgyProject, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = project.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium
                )
                val subtitle = buildString {
                    append(project.type.replace("gemini-", "").replaceFirstChar { it.uppercase() })
                    project.age?.let { append(" • ") }
                }
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            }
            if (project.hasWalkthrough == true) {
                Box(
                    modifier = Modifier
                        .padding(end = 12.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color(0xFF2ECC71).copy(alpha = 0.2f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text("DOCS", style = MaterialTheme.typography.labelSmall, color = Color(0xFF2ECC71))
                }
            }
            StatusChip(status = project.status)
        }
    }
}

@Composable
private fun StatusChip(status: String) {
    val color = when (status.lowercase()) {
        "working" -> ZeroSecondary
        "completed" -> Color(0xFF2ECC71)
        "failed" -> Color(0xFFD94A4A)
        "waiting" -> Color(0xFFE6A23C)
        else -> MaterialTheme.colorScheme.primary
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = status.replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.labelMedium,
            color = color
        )
    }
}
