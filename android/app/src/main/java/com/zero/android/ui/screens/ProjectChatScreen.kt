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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zero.android.data.model.AgentLog
import com.zero.android.data.model.AgentUiModel
import com.zero.android.data.model.AgyProject
import com.zero.android.data.model.ChatProject
import com.zero.android.data.model.ThreadEntry

enum class ChatView { CHAT, LOGS }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectChatScreen(
    projectId: String?,
    agents: List<AgentUiModel>,
    agyProjects: List<AgyProject>,
    onBack: () -> Unit,
    onSendMessage: (String, String) -> Unit
) {
    val project = remember(projectId, agents, agyProjects) {
        val agent = agents.firstOrNull { it.id == projectId }
        if (agent != null) {
            ChatProject(agent.id, agent.name, agent.status, agent.logs, agent.threads)
        } else {
            val agy = agyProjects.firstOrNull { it.id == projectId }
            if (agy != null) {
                ChatProject(agy.id, agy.name, agy.status, agy.logs, agy.threads)
            } else null
        }
    }

    var messageText by remember { mutableStateOf("") }
    var currentView by remember { mutableStateOf(ChatView.CHAT) }
    val listState = rememberLazyListState()

    // Combine logs and threads into a single chronological message list
    val allMessages = remember(project?.logs, project?.threads) {
        val combined = mutableListOf<ChatMessage>()
        project?.threads?.forEach { t ->
            combined.add(ChatMessage(t.timestamp, t.role, t.content))
        }
        project?.logs?.forEach { l ->
            combined.add(ChatMessage(l.timestamp, "system", l.message, l.type))
        }
        combined.sortedBy { it.timestamp }
    }

    val displayMessages = remember(allMessages, currentView) {
        if (currentView == ChatView.LOGS) {
            allMessages
        } else {
            allMessages.filter { msg ->
                if (msg.role != "system") return@filter true
                // Only show high-signal logs in chat
                msg.type in listOf("success", "error", "warning")
            }
        }
    }

    LaunchedEffect(displayMessages.size) {
        if (displayMessages.isNotEmpty()) {
            listState.animateScrollToItem(displayMessages.size - 1)
        }
    }

    Scaffold(
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        Column {
                            Text(text = project?.name ?: "Chat", style = MaterialTheme.typography.titleMedium)
                            if (project != null) {
                                Text(
                                    text = project.status.uppercase(),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                        }
                    }
                )
                TabRow(
                    selectedTabIndex = currentView.ordinal,
                    modifier = Modifier.fillMaxWidth(),
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = MaterialTheme.colorScheme.primary
                ) {
                    Tab(
                        selected = currentView == ChatView.CHAT,
                        onClick = { currentView = ChatView.CHAT },
                        text = { Text("Chat") }
                    )
                    Tab(
                        selected = currentView == ChatView.LOGS,
                        onClick = { currentView = ChatView.LOGS },
                        text = { Text("Logs") }
                    )
                }
            }
        }
    ) { padding ->
        if (project == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Text("Project not found")
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item { Spacer(modifier = Modifier.height(8.dp)) }
                items(displayMessages) { msg ->
                    MessageBubble(msg, currentView)
                }
                item { Spacer(modifier = Modifier.height(8.dp)) }
            }

            // Input Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = messageText,
                    onValueChange = { messageText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Message...") },
                    shape = RoundedCornerShape(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(
                    onClick = {
                        val trimmed = messageText.trim()
                        if (trimmed.isNotEmpty() && project.id.isNotBlank()) {
                            onSendMessage(project.id, trimmed)
                            messageText = ""
                        }
                    },
                    modifier = Modifier
                        .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(50))
                        .size(48.dp)
                ) {
                    Icon(Icons.Default.Send, contentDescription = "Send", tint = MaterialTheme.colorScheme.onPrimary)
                }
            }
        }
    }
}

data class ChatMessage(
    val timestamp: String,
    val role: String,
    val content: String,
    val type: String? = null // For system logs
)

@Composable
fun MessageBubble(msg: ChatMessage, currentView: ChatView) {
    val isUser = msg.role.equals("user", ignoreCase = true)
    val isSystem = msg.role == "system"
    
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        val baseColor = if (isUser) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
        val textColor = if (isUser) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant
        
        // In logs view, use a more compact, transparent style for system logs
        val bubbleColor = if (isSystem) {
            if (currentView == ChatView.LOGS) {
                Color.Transparent
            } else {
                when (msg.type) {
                    "error" -> Color(0xFFD94A4A).copy(alpha = 0.1f)
                    "success" -> Color(0xFF2ECC71).copy(alpha = 0.1f)
                    "thinking" -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    else -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
                }
            }
        } else baseColor

        val actualTextColor = if (isSystem && msg.type == "error") {
            Color(0xFFD94A4A)
        } else if (isSystem && msg.type == "success") {
            Color(0xFF2ECC71)
        } else textColor

        Box(
            modifier = Modifier
                .fillMaxWidth(if (isSystem && currentView == ChatView.LOGS) 1f else 0.85f)
                .clip(RoundedCornerShape(
                    topStart = 16.dp,
                    topEnd = 16.dp,
                    bottomStart = if (isUser) 16.dp else 4.dp,
                    bottomEnd = if (isUser) 4.dp else 16.dp
                ))
                .background(bubbleColor)
                .padding(if (isSystem && currentView == ChatView.LOGS) 4.dp else 12.dp)
        ) {
            Column {
                if (!isUser && !isSystem) {
                    Text(
                        text = "AGENT",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )
                }
                Text(
                    text = if (isSystem && currentView == ChatView.LOGS) "› ${msg.content}" else msg.content,
                    style = if (isSystem) MaterialTheme.typography.bodySmall else MaterialTheme.typography.bodyMedium,
                    color = actualTextColor,
                    fontFamily = if (isSystem) androidx.compose.ui.text.font.FontFamily.Monospace else androidx.compose.ui.text.font.FontFamily.Default,
                    lineHeight = if (isSystem && currentView == ChatView.LOGS) androidx.compose.ui.unit.TextUnit.Unspecified else MaterialTheme.typography.bodyMedium.lineHeight
                )
            }
        }
    }
}
