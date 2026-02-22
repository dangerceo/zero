package com.zero.android.wearables.cameraaccess.mockdevicekit

import com.meta.wearable.dat.mockdevice.api.MockRaybanMeta

data class MockDeviceInfo(
    val device: MockRaybanMeta,
    val deviceId: String,
    val deviceName: String,
    val hasCameraFeed: Boolean = false,
    val hasCapturedImage: Boolean = false,
)

data class MockDeviceKitUiState(
    val pairedDevices: List<MockDeviceInfo> = emptyList(),
)
