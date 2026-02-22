package com.zero.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import androidx.navigation.compose.rememberNavController
import com.zero.android.service.MonitoringManager
import com.zero.android.ui.screens.OnboardingScreen
import com.zero.android.ui.screens.ProjectDetailScreen
import com.zero.android.ui.screens.ProjectsScreen
import com.zero.android.ui.screens.SettingsScreen
import com.zero.android.ui.screens.TasksScreen
import com.zero.android.ui.screens.WearablesScreen
import com.zero.android.wearables.cameraaccess.CameraAccessScreen

private object Routes {
    const val Onboarding = "onboarding"
    const val Projects = "projects"
    const val Tasks = "tasks"
    const val ProjectDetail = "projectDetail"
    const val TaskDetail = "taskDetail"
    const val Settings = "settings"
    const val Wearables = "wearables"
    const val CameraAccess = "cameraAccess"
}

@Composable
fun ZeroApp(
    viewModel: MainViewModel,
    initialAgentId: String?
) {
    val navController = rememberNavController()
    val baseUrl by viewModel.baseUrl.collectAsState()
    val agents by viewModel.agents.collectAsState()
    val agyProjects by viewModel.agyProjects.collectAsState()
    val connection by viewModel.connection.collectAsState()
    val monitoringEnabled by viewModel.monitoringEnabled.collectAsState()
    val context = LocalContext.current

    val startDestination = if (baseUrl.isNullOrBlank()) Routes.Onboarding else Routes.Projects

    LaunchedEffect(baseUrl) {
        if (!baseUrl.isNullOrBlank()) {
            navController.navigate(Routes.Projects) {
                launchSingleTop = true
                popUpTo(Routes.Onboarding) { inclusive = true }
            }
        }
    }

    LaunchedEffect(initialAgentId) {
        if (!initialAgentId.isNullOrBlank()) {
            navController.navigate("${Routes.ProjectDetail}/$initialAgentId") {
                launchSingleTop = true
            }
        }
    }

    LaunchedEffect(monitoringEnabled, baseUrl) {
        if (monitoringEnabled && !baseUrl.isNullOrBlank()) {
            MonitoringManager.start(context)
        } else {
            MonitoringManager.stop(context)
        }
    }

    NavHost(navController = navController, startDestination = startDestination) {
        composable(Routes.Onboarding) {
            OnboardingScreen(
                onBaseUrlSet = { viewModel.setBaseUrl(it) }
            )
        }
        composable(Routes.Projects) {
            ProjectsScreen(
                agents = agents,
                agyProjects = agyProjects,
                connectionState = connection,
                onRefresh = { viewModel.refresh() },
                onSettings = { navController.navigate(Routes.Settings) },
                onWearables = { navController.navigate(Routes.Wearables) },
                onTasks = {
                    navController.navigate(Routes.Tasks) {
                        launchSingleTop = true
                    }
                },
                onAgentSelected = { agentId ->
                    navController.navigate("${Routes.ProjectDetail}/$agentId")
                }
            )
        }
        composable(Routes.Tasks) {
            TasksScreen(
                agents = agents,
                connectionState = connection,
                onRefresh = { viewModel.refresh() },
                onSettings = { navController.navigate(Routes.Settings) },
                onWearables = { navController.navigate(Routes.Wearables) },
                onProjects = {
                    navController.navigate(Routes.Projects) {
                        launchSingleTop = true
                    }
                },
                onAgentSelected = { agentId ->
                    navController.navigate("${Routes.ProjectDetail}/$agentId")
                },
                onCreateAgent = { goal ->
                    viewModel.createAgent(goal)
                }
            )
        }
        composable(
            route = "${Routes.ProjectDetail}/{agentId}",
            arguments = listOf(navArgument("agentId") { type = NavType.StringType })
        ) { backStackEntry ->
            val agentId = backStackEntry.arguments?.getString("agentId")
            ProjectDetailScreen(
                agentId = agentId,
                agents = agents,
                onBack = { navController.popBackStack() }
            )
        }
        composable(Routes.Settings) {
            SettingsScreen(
                baseUrl = baseUrl,
                monitoringEnabled = monitoringEnabled,
                onBaseUrlUpdate = viewModel::setBaseUrl,
                onClearBaseUrl = viewModel::clearBaseUrl,
                onMonitoringToggle = viewModel::setMonitoringEnabled,
                onBack = { navController.popBackStack() },
                onRescan = { navController.navigate(Routes.Onboarding) },
                onWearables = { navController.navigate(Routes.Wearables) }
            )
        }
        composable(Routes.Wearables) {
            WearablesScreen(
                onBack = { navController.popBackStack() },
                onCameraAccess = { navController.navigate(Routes.CameraAccess) },
            )
        }
        composable(Routes.CameraAccess) {
            CameraAccessScreen(
                onBack = { navController.popBackStack() }
            )
        }
    }
}
