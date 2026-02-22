package com.zero.android.wearables.cameraaccess.wearables

import com.meta.wearable.dat.core.types.DeviceIdentifier
import com.meta.wearable.dat.core.types.RegistrationState
import kotlinx.collections.immutable.ImmutableList
import kotlinx.collections.immutable.persistentListOf

data class WearablesUiState(
    val registrationState: RegistrationState = RegistrationState.Unavailable(),
    val devices: ImmutableList<DeviceIdentifier> = persistentListOf(),
    val recentError: String? = null,
    val isStreaming: Boolean = false,
    val hasMockDevices: Boolean = false,
    val isDebugMenuVisible: Boolean = false,
    val isGettingStartedSheetVisible: Boolean = false,
    val hasActiveDevice: Boolean = false,
) {
    val isRegistered: Boolean = registrationState is RegistrationState.Registered || hasMockDevices
}
