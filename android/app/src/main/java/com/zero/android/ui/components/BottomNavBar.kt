package com.zero.android.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ListAlt
import androidx.compose.material.icons.filled.Workspaces
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

enum class BottomTab {
    Projects,
    Tasks
}

@Composable
fun BottomNavBar(
    current: BottomTab,
    onProjects: () -> Unit,
    onTasks: () -> Unit
) {
    NavigationBar {
        NavigationBarItem(
            selected = current == BottomTab.Projects,
            onClick = onProjects,
            icon = { androidx.compose.material3.Icon(Icons.Default.Workspaces, contentDescription = null) },
            label = { Text("Projects") }
        )
        NavigationBarItem(
            selected = current == BottomTab.Tasks,
            onClick = onTasks,
            icon = { androidx.compose.material3.Icon(Icons.Default.ListAlt, contentDescription = null) },
            label = { Text("Tasks") }
        )
    }
}
