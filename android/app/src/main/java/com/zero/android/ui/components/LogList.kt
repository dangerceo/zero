package com.zero.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zero.android.util.formatIsoTime

enum class LogFilter(val label: String) {
    All("All"),
    Info("Info"),
    Output("Output"),
    Success("Success"),
    Warning("Warning"),
    Error("Error")
}

data class LogEntry(
    val message: String,
    val type: String?,
    val timestamp: String?
)

@Composable
fun LogList(
    logs: List<LogEntry>,
    modifier: Modifier = Modifier
) {
    val listState = rememberLazyListState()
    var filter by remember { mutableStateOf(LogFilter.All) }
    val expanded = remember { mutableStateMapOf<Int, Boolean>() }
    val clipboard = LocalClipboardManager.current

    val filteredLogs = when (filter) {
        LogFilter.All -> logs
        LogFilter.Info -> logs.filter { it.type.equals("info", true) }
        LogFilter.Output -> logs.filter { it.type.equals("output", true) }
        LogFilter.Success -> logs.filter { it.type.equals("success", true) }
        LogFilter.Warning -> logs.filter { it.type.equals("warning", true) }
        LogFilter.Error -> logs.filter { it.type.equals("error", true) }
    }

    LaunchedEffect(filteredLogs.size) {
        if (filteredLogs.isNotEmpty()) {
            listState.animateScrollToItem(filteredLogs.size - 1)
        }
    }

    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LogFilter.values().forEach { option ->
                    FilterChip(
                        selected = filter == option,
                        onClick = { filter = option },
                        label = { Text(option.label) }
                    )
                }
            }
            TextButton(onClick = {
                val content = logs.joinToString("\n") { log ->
                    val stamp = formatIsoTime(log.timestamp)
                    val type = log.type ?: ""
                    listOf(stamp, type, log.message).filter { it.isNotBlank() }.joinToString(" | ")
                }
                clipboard.setText(AnnotatedString(content))
            }) {
                Text("Copy")
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        if (filteredLogs.isEmpty()) {
            Text(
                text = "No logs yet",
                style = MaterialTheme.typography.bodyMedium
            )
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxWidth(),
                state = listState,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                itemsIndexed(filteredLogs) { index, log ->
                    val isExpanded = expanded[index] == true
                    val color = when (log.type?.lowercase()) {
                        "error" -> Color(0xFFD94A4A)
                        "warning" -> Color(0xFFE6A23C)
                        "success" -> Color(0xFF2ECC71)
                        "output" -> MaterialTheme.colorScheme.primary
                        else -> MaterialTheme.colorScheme.onSurface
                    }

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                color.copy(alpha = 0.08f),
                                shape = MaterialTheme.shapes.medium
                            )
                            .padding(12.dp)
                            .clickable { expanded[index] = !isExpanded }
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = log.type?.uppercase() ?: "INFO",
                                style = MaterialTheme.typography.labelMedium,
                                color = color
                            )
                            Spacer(modifier = Modifier.size(12.dp))
                            if (!log.timestamp.isNullOrBlank()) {
                                Text(
                                    text = formatIsoTime(log.timestamp),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = log.message,
                            style = MaterialTheme.typography.bodyMedium,
                            fontFamily = FontFamily.Monospace,
                            color = color,
                            maxLines = if (isExpanded) Int.MAX_VALUE else 4,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}
