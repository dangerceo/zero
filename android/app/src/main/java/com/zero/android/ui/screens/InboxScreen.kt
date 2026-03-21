package com.zero.android.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.zero.android.data.model.Intervention
import com.zero.android.ui.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboxScreen(viewModel: MainViewModel) {
    val interventions by viewModel.interventions.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Inbox") })
        }
    ) { padding ->
        if (interventions.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = androidx.compose.ui.Alignment.Center) {
                Text("No active interventions", style = MaterialTheme.typography.bodyLarge)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(interventions, key = { it.id }) { intervention ->
                    InterventionCard(
                        intervention = intervention,
                        onResponse = { response ->
                            viewModel.intervene(intervention.agentId, intervention.id, response)
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun InterventionCard(
    intervention: Intervention,
    onResponse: (String) -> Unit
) {
    var textResponse by remember { mutableStateOf("") }

    ElevatedCard(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = intervention.agentName ?: "Agent",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = intervention.message, style = MaterialTheme.typography.bodyLarge)
            
            Spacer(modifier = Modifier.height(16.dp))

            when (intervention.type) {
                "input" -> {
                    OutlinedTextField(
                        value = textResponse,
                        onValueChange = { textResponse = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Your response") },
                        trailingIcon = {
                            TextButton(
                                onClick = { onResponse(textResponse) },
                                enabled = textResponse.isNotBlank()
                            ) {
                                Text("Send")
                            }
                        }
                    )
                }
                "confirm" -> {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        OutlinedButton(onClick = { onResponse("no") }) { Text("No") }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(onClick = { onResponse("yes") }) { Text("Yes") }
                    }
                }
                "choice" -> {
                    FlowRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        intervention.options.forEach { option ->
                            SuggestionChip(
                                onClick = { onResponse(option.value) },
                                label = { Text(option.label) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowRow(
    modifier: Modifier = Modifier,
    horizontalArrangement: Arrangement.Horizontal = Arrangement.Start,
    content: @Composable () -> Unit
) {
    androidx.compose.foundation.layout.FlowRow(
        modifier = modifier,
        horizontalArrangement = horizontalArrangement,
        content = { content() }
    )
}
