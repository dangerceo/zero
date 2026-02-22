package com.zero.android.wearables.cameraaccess

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.LocalActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.Text
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.types.Permission
import com.meta.wearable.dat.core.types.PermissionStatus
import com.zero.android.wearables.cameraaccess.ui.CameraAccessScaffold
import com.zero.android.wearables.cameraaccess.wearables.WearablesViewModel
import kotlin.coroutines.resume
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CameraAccessScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val activity = LocalActivity.current
    val viewModel: WearablesViewModel = viewModel()

    val permissionMutex = remember { Mutex() }
    var permissionContinuation by remember { mutableStateOf<CancellableContinuation<PermissionStatus>?>(null) }

    val wearablesPermissionLauncher = rememberLauncherForActivityResult(
        Wearables.RequestPermissionContract()
    ) { result ->
        val status = result.getOrDefault(PermissionStatus.Denied)
        permissionContinuation?.resume(status)
        permissionContinuation = null
    }

    val requestWearablesPermission: suspend (Permission) -> PermissionStatus = remember {
        { permission ->
            permissionMutex.withLock {
                suspendCancellableCoroutine { continuation ->
                    permissionContinuation = continuation
                    continuation.invokeOnCancellation { permissionContinuation = null }
                    wearablesPermissionLauncher.launch(permission)
                }
            }
        }
    }

    val requiredPermissions = remember {
        val permissions = mutableListOf(
            Manifest.permission.BLUETOOTH,
            Manifest.permission.INTERNET,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
        }
        permissions.toTypedArray()
    }

    var permissionsRequested by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(RequestMultiplePermissions()) { results ->
        val granted = results.values.all { it }
        if (granted) {
            WearablesBootstrap.ensureInitialized(context)
            viewModel.startMonitoring()
        } else {
            viewModel.setRecentError("Allow Bluetooth and Internet permissions")
        }
    }

    LaunchedEffect(requiredPermissions) {
        if (permissionsRequested) return@LaunchedEffect
        permissionsRequested = true
        val hasPermissions = requiredPermissions.all { permission ->
            ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
        }
        if (hasPermissions) {
            WearablesBootstrap.ensureInitialized(context)
            viewModel.startMonitoring()
        } else if (activity != null) {
            permissionLauncher.launch(requiredPermissions)
        } else {
            viewModel.setRecentError("Activity not available")
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(text = "Camera Access") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        CameraAccessScaffold(
            viewModel = viewModel,
            onRequestWearablesPermission = requestWearablesPermission,
            modifier = Modifier.padding(padding)
        )
    }
}
