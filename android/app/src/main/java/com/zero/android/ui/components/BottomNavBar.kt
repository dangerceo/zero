package com.zero.android.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.ListAlt
import androidx.compose.material.icons.filled.Workspaces
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

enum class BottomTab {
    Projects,
    Tasks,
    Camera
}

@Composable
fun BottomNavBar(
    current: BottomTab,
    onProjects: () -> Unit,
    onTasks: () -> Unit,
    onCamera: () -> Unit
) {
    NavigationBar {
        NavigationBarItem(
            selected = current == BottomTab.Projects,
            onClick = onProjects,
            icon = { Icon(Icons.Default.Workspaces, contentDescription = "Projects") },
            label = { Text("Projects") }
        )
        NavigationBarItem(
            selected = false,
            onClick = onCamera,
            icon = { Icon(Icons.Default.CameraAlt, contentDescription = "Camera") },
            label = { Text("Camera") }
        )
        NavigationBarItem(
            selected = current == BottomTab.Tasks,
            onClick = onTasks,
            icon = { Icon(Icons.Default.ListAlt, contentDescription = "Tasks") },
            label = { Text("Tasks") }
        )
    }
}
