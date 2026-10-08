#ifndef CAMERA_STREAM_H
#define CAMERA_STREAM_H

#include <Arduino.h>
#include "esp_camera.h"
#include <HTTPClient.h>
#include "config.h"

class CameraStream {
public:
    CameraStream();
    bool begin();
    void pushFrameToPC();
    bool isReady();
    camera_fb_t* captureFrame();
    void releaseFrame(camera_fb_t* fb);

private:
    bool _initialized;
    unsigned long _lastFramePush;
};

extern CameraStream cameraStream;

#endif // CAMERA_STREAM_H
