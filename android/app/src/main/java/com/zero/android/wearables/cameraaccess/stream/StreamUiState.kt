package com.zero.android.wearables.cameraaccess.stream

import android.graphics.Bitmap
import com.meta.wearable.dat.camera.types.StreamSessionState

data class StreamUiState(
    val streamSessionState: StreamSessionState = StreamSessionState.STOPPED,
    val videoFrame: Bitmap? = null,
    val capturedPhoto: Bitmap? = null,
    val isShareDialogVisible: Boolean = false,
    val isCapturing: Boolean = false,
)
