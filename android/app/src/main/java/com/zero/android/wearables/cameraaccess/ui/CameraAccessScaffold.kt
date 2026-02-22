package com.zero.android.wearables.cameraaccess.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Error
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.meta.wearable.dat.core.types.Permission
import com.meta.wearable.dat.core.types.PermissionStatus
import com.zero.android.BuildConfig
import com.zero.android.wearables.cameraaccess.wearables.WearablesViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CameraAccessScaffold(
    viewModel: WearablesViewModel,
    onRequestWearablesPermission: suspend (Permission) -> PermissionStatus,
    modifier: Modifier = Modifier,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val bottomSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(uiState.recentError) {
        uiState.recentError?.let { errorMessage ->
            snackbarHostState.showSnackbar(errorMessage)
            viewModel.clearCameraPermissionError()
        }
    }

    Surface(modifier = modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Box(modifier = Modifier.fillMaxSize()) {
            when {
                uiState.isStreaming ->
                    StreamScreen(
                        wearablesViewModel = viewModel,
                    )
                uiState.isRegistered ->
                    NonStreamScreen(
                        viewModel = viewModel,
                        onRequestWearablesPermission = onRequestWearablesPermission,
                    )
                else ->
                    HomeScreen(
                        viewModel = viewModel,
                    )
            }

            SnackbarHost(
                hostState = snackbarHostState,
                modifier =
                Modifier.align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 32.dp),
                snackbar = { data ->
                    Snackbar(
                        shape = RoundedCornerShape(24.dp),
                        containerColor = MaterialTheme.colorScheme.errorContainer,
                        contentColor = MaterialTheme.colorScheme.onErrorContainer,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Error,
                                contentDescription = "Camera Access error",
                                tint = MaterialTheme.colorScheme.error,
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(data.visuals.message)
                        }
                    }
                },
            )

            if (BuildConfig.DEBUG) {
                FloatingActionButton(
                    onClick = { viewModel.showDebugMenu() },
                    modifier = Modifier.align(Alignment.CenterEnd),
                ) {
                    Icon(Icons.Default.BugReport, contentDescription = "Debug Menu")
                }

                if (uiState.isDebugMenuVisible) {
                    ModalBottomSheet(
                        onDismissRequest = { viewModel.hideDebugMenu() },
                        sheetState = bottomSheetState,
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        MockDeviceKitScreen(modifier = Modifier.fillMaxSize())
                    }
                }
            }
        }
    }
}
