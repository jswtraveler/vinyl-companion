# Manual Testing Guide - Camera Functionality

This guide covers manual tests that require real device interaction and cannot be fully automated with unit tests.

## Pre-requisites

- **Device with camera**: Desktop with webcam, laptop, or mobile device
- **Modern browser**: Chrome 91+, Safari 14+, Firefox 90+, Edge 91+
- **HTTPS connection**: Camera requires secure context (localhost is allowed for development)
- **Browser permissions**: Allow camera access when prompted

## Test Environment Setup

1. **Development Server**: Run `npm run dev` and access via `http://localhost:5176`
2. **Production Build**: Run `npm run build` and `npx serve dist` for `http://localhost:1731`
3. **Mobile Testing**: Use ngrok or similar to test on actual mobile devices over HTTPS

---

## Camera Access & Permissions Tests

### Test CA-1: Camera Permission Grant
**Objective**: Verify camera permission request and grant flow

**Steps**:
1. Open the Vinyl Companion app
2. Click the "Identify Album" (camera) button
3. Browser should prompt for camera permissions
4. Click "Allow" or "Grant"

**Expected Results**:
- ✅ Camera permission dialog appears
- ✅ After granting, camera interface loads with live video feed
- ✅ Header shows "Album Cover Capture"
- ✅ Bottom shows camera controls and guide text
- ✅ Album cover guide overlay is visible

**Failure Scenarios**:
- ❌ No permission prompt appears
- ❌ Error message shows instead of camera interface
- ❌ Camera interface loads but no video feed visible

---

### Test CA-2: Camera Permission Denial
**Objective**: Verify graceful handling of denied camera access

**Steps**:
1. Open the app in incognito/private mode
2. Click "Identify Album" button
3. When browser prompts for camera, click "Block" or "Deny"

**Expected Results**:
- ✅ Error dialog appears with "Camera Access Issue" title
- ✅ Shows helpful message about camera being denied
- ✅ Displays instructions to enable camera (click browser icon, allow access)
- ✅ "Try Again" button is available
- ✅ "Close" button returns to main app

---

### Test CA-3: No Camera Available
**Objective**: Test behavior on devices without camera

**Steps**:
1. Test on device without camera OR
2. Disable camera in browser settings OR
3. Use browser developer tools to simulate no camera

**Expected Results**:
- ✅ Error dialog shows "No camera found" message
- ✅ Suggests checking device has camera
- ✅ Try Again and Close buttons work appropriately

---

## Camera Interface Tests

### Test CI-1: Camera Feed Quality
**Objective**: Verify camera video feed displays correctly

**Steps**:
1. Grant camera permissions and open camera interface
2. Position an album cover in front of camera
3. Move it around to test tracking

**Expected Results**:
- ✅ Video feed is clear and responsive (not choppy)
- ✅ Feed fills entire screen area appropriately
- ✅ Album cover guide overlay is properly positioned
- ✅ No significant lag between real movement and display

---

### Test CI-2: Camera Switching (Multi-Camera Devices)
**Objective**: Test camera switching functionality

**Prerequisites**: Device with multiple cameras (front/back)

**Steps**:
1. Open camera interface
2. Look for camera switch button in top-right
3. Click the switch camera button
4. Verify camera changes

**Expected Results**:
- ✅ Switch button appears when multiple cameras detected
- ✅ Clicking switch changes to different camera
- ✅ Video feed updates to new camera
- ✅ Camera info text updates to show new camera name
- ✅ Can switch between all available cameras

**Single Camera Results**:
- ✅ No switch button appears with only one camera

---

### Test CI-3: Interface Controls
**Objective**: Verify all camera interface controls work

**Steps**:
1. Open camera interface
2. Test each control button
3. Verify proper behavior

**Control Tests**:
- **Close button (X)**: Returns to main app
- **Cancel button**: Returns to main app  
- **Capture button**: Should be enabled when streaming
- **Switch camera** (if available): Changes camera
- **Album guide overlay**: Visible and well-positioned

---

## Image Capture Tests

### Test IC-1: Basic Photo Capture
**Objective**: Test core photo capture functionality

**Steps**:
1. Open camera interface with album cover ready
2. Position album cover within the guide overlay
3. Click the large circular capture button
4. Wait for processing

**Expected Results**:
- ✅ Capture button shows loading spinner briefly
- ✅ Photo preview screen appears with captured image
- ✅ Preview shows clear, properly oriented image
- ✅ "Retake" and "Use Photo" buttons are visible and functional

---

### Test IC-2: Image Quality and Resolution
**Objective**: Verify captured image quality meets requirements

**Steps**:
1. Capture photo of album cover in good lighting
2. Examine preview for quality issues
3. Test in various lighting conditions

**Expected Results**:
- ✅ Image resolution is appropriate for album identification (should be 1280px+ width)
- ✅ Image is clear and focused
- ✅ Colors are accurate and not over-saturated
- ✅ No significant distortion or compression artifacts
- ✅ File size reasonable (typically 200KB-1MB for JPEG)

**Quality Tests**:
- 🔆 **Good lighting**: Should produce excellent quality
- 🌙 **Low light**: Should still be usable, may have some grain
- ☀️ **Bright light**: Should handle without overexposure
- 📐 **Various angles**: Should maintain quality at reasonable angles

---

### Test IC-3: Retake Functionality
**Objective**: Test ability to retake unsatisfactory photos

**Steps**:
1. Capture a photo (any quality)
2. In preview screen, click "Retake" button
3. Verify return to camera interface
4. Capture another photo

**Expected Results**:
- ✅ "Retake" button returns to live camera feed
- ✅ Previous photo is discarded
- ✅ Can capture new photo normally
- ✅ Process can be repeated multiple times

---

## Album Integration Tests

### Test AI-1: Save Photo to Album
**Objective**: Test integration with album creation workflow

**Steps**:
1. Capture a good quality photo of album cover
2. In preview, click "Use Photo" button
3. Verify album form opens
4. Fill in basic album details (title, artist)
5. Save album

**Expected Results**:
- ✅ Camera closes and album form opens
- ✅ Form is pre-populated with captured image
- ✅ Image appears as album cover in form
- ✅ Can fill in and save album normally
- ✅ Album appears in collection with captured cover image
- ✅ Cover image persists after page refresh

---

### Test AI-2: Album Cover Storage
**Objective**: Verify image storage and retrieval

**Steps**:
1. Create album with captured photo
2. Navigate away and back to collection
3. Refresh page completely
4. Check if album cover persists

**Expected Results**:
- ✅ Album cover image displays in collection grid
- ✅ Image persists after navigation
- ✅ Image persists after page refresh
- ✅ Image loads reasonably quickly
- ✅ Quality maintained in album card display

---

## Error Handling Tests

### Test EH-1: Camera Error Recovery
**Objective**: Test recovery from various camera errors

**Error Scenarios to Test**:
1. **Camera becomes unavailable** (unplug webcam during use)
2. **Camera taken by another app** (open camera app while using)
3. **Network issues** (if using external camera)

**Expected Results for All Scenarios**:
- ✅ Clear error message explaining the issue
- ✅ "Try Again" button to attempt recovery
- ✅ "Close" button to exit gracefully
- ✅ No app crashes or broken states

---

### Test EH-2: Capture Failure Recovery
**Objective**: Test handling of photo capture failures

**Steps**:
1. Start capture process
2. Simulate failure (cover camera, very low light, etc.)
3. Verify error handling

**Expected Results**:
- ✅ Graceful error message if capture fails
- ✅ Ability to retry capture
- ✅ Camera interface remains functional
- ✅ No crashes or broken states

---

## Performance Tests

### Test PE-1: Camera Initialization Speed
**Objective**: Verify camera starts in reasonable time

**Steps**:
1. Click "Identify Album" button
2. Time from click to video feed appearing
3. Test multiple times

**Expected Results**:
- ✅ Camera interface appears within 2-3 seconds
- ✅ Video feed starts within 1-2 seconds after interface
- ✅ Consistent performance across attempts

---

### Test PE-2: Memory Usage
**Objective**: Ensure camera doesn't cause memory leaks

**Steps**:
1. Open browser developer tools
2. Monitor memory usage
3. Open/close camera multiple times
4. Capture several photos
5. Check memory usage trends

**Expected Results**:
- ✅ Memory usage doesn't continuously increase
- ✅ Camera resources properly released on close
- ✅ No significant memory accumulation after multiple uses

---

## Cross-Browser Tests

### Test CB-1: Browser Compatibility
**Objective**: Verify functionality across different browsers

**Browsers to Test**:
- ✅ **Chrome/Chromium** (primary target)
- ✅ **Firefox** 
- ✅ **Safari** (on macOS/iOS)
- ✅ **Edge**

**Test for Each Browser**:
- Camera permission flow
- Video feed quality
- Photo capture functionality
- UI layout and responsiveness
- Error handling

---

### Test CB-2: Mobile Device Testing
**Objective**: Test on actual mobile devices

**Devices to Test** (if available):
- 📱 **Android phones** (Chrome browser)
- 📱 **iPhones** (Safari browser)
- 📱 **Tablets** (both platforms)

**Mobile-Specific Tests**:
- Touch interface usability
- Camera orientation (portrait/landscape)
- Front/back camera switching
- Photo quality on mobile cameras
- Performance on mobile hardware

---

## Accessibility Tests

### Test AC-1: Keyboard Navigation
**Objective**: Verify camera interface is keyboard accessible

**Steps**:
1. Open camera interface
2. Use Tab key to navigate controls
3. Use Enter/Space to activate buttons

**Expected Results**:
- ✅ Can tab to all interactive elements
- ✅ Focus indicators are visible
- ✅ Enter/Space activates buttons properly
- ✅ Escape key closes camera interface

---

### Test AC-2: Screen Reader Compatibility
**Objective**: Test with screen reading software (if available)

**Steps**:
1. Enable screen reader (VoiceOver on Mac, NVDA on Windows)
2. Navigate camera interface
3. Verify announcements are meaningful

**Expected Results**:
- ✅ Buttons have appropriate labels
- ✅ Camera states are announced
- ✅ Error messages are read aloud
- ✅ Navigation flow is logical

---

## Test Data Collection

For each test, please record:

- ✅ **Pass/Fail status**
- 🖥️ **Device/Browser combination**
- 📅 **Test date**
- 📝 **Notes/observations**
- 🐛 **Issues found** (if any)

### Issue Reporting Template

```
**Test**: [Test ID and name]
**Device**: [Device/browser info]
**Issue**: [Brief description]
**Steps to Reproduce**: [Detailed steps]
**Expected**: [What should happen]
**Actual**: [What actually happened]
**Severity**: [High/Medium/Low]
**Screenshot**: [If applicable]
```

---

## Test Completion Checklist

Before considering camera functionality complete:

### Core Functionality
- [ ] Camera permissions work on all target browsers
- [ ] Video feed displays properly on all devices
- [ ] Photo capture produces good quality images
- [ ] Image preview and retake work correctly
- [ ] Albums save with captured photos
- [ ] Images persist after page refresh

### Error Handling  
- [ ] Permission denied handled gracefully
- [ ] No camera scenarios handled well
- [ ] Camera busy/unavailable errors managed
- [ ] Capture failures don't crash app
- [ ] Recovery options work properly

### Performance
- [ ] Camera initializes quickly (<3 seconds)
- [ ] No memory leaks after repeated use
- [ ] Responsive interface on all devices
- [ ] Good image quality in various lighting

### Cross-Platform
- [ ] Works on primary desktop browsers
- [ ] Functions properly on mobile devices
- [ ] UI scales appropriately for different screens
- [ ] Touch controls work well on mobile

### Accessibility
- [ ] Keyboard navigation fully functional
- [ ] Screen reader compatible (if tested)
- [ ] Error messages are clear and helpful
- [ ] Focus management works properly

---

## Notes

- **HTTPS Requirement**: Camera functionality only works over HTTPS in production
- **Mobile Testing**: Use ngrok or similar for testing on actual mobile devices
- **Performance**: Camera can be resource-intensive, especially on older devices
- **Privacy**: Always inform users about camera usage and get consent
- **Fallbacks**: Manual album entry should always be available as alternative

## Quick Test Checklist

For rapid validation during development:

### ✅ Essential Tests (5 minutes)
- [ ] Camera opens and shows live feed
- [ ] Capture button works and shows preview  
- [ ] "Use Photo" saves to album form
- [ ] Error handling works for denied permissions
- [ ] Camera switch works (if multiple cameras)

### ✅ Extended Tests (15 minutes) 
- [ ] All error states display properly
- [ ] Photo quality is acceptable 
- [ ] Works on mobile device via HTTPS
- [ ] Retake functionality works
- [ ] Keyboard navigation functional

---

## Development Testing Setup

### Local Testing Commands
```bash
# Start development server
npm run dev

# Run automated tests first
npm test CameraCapture

# For mobile testing with ngrok
npx ngrok http 5173
# Then test on mobile using https://[id].ngrok.io
```

### Browser DevTools Setup
1. Open DevTools (F12)
2. Go to Application > Permissions
3. Reset camera permissions for testing
4. Use Network throttling to test slow connections
5. Use Device simulation for mobile testing

---

## Test Data Recording

### Test Session Template
```
Date: ___________
Tester: ___________
Environment: ___________
Browser: ___________
Device: ___________

Test Results:
- CA-1 (Camera Permission Grant): ☐ Pass ☐ Fail
- CA-2 (Permission Denial): ☐ Pass ☐ Fail  
- CA-3 (No Camera): ☐ Pass ☐ Fail
- CI-1 (Feed Quality): ☐ Pass ☐ Fail
- CI-2 (Camera Switching): ☐ Pass ☐ Fail ☐ N/A
- CI-3 (Interface Controls): ☐ Pass ☐ Fail
- IC-1 (Basic Capture): ☐ Pass ☐ Fail
- IC-2 (Image Quality): ☐ Pass ☐ Fail
- IC-3 (Retake): ☐ Pass ☐ Fail
- AI-1 (Save to Album): ☐ Pass ☐ Fail
- AI-2 (Storage): ☐ Pass ☐ Fail

Critical Issues Found:
1. ________________________
2. ________________________
3. ________________________

Notes:
________________________________
```

---

This manual testing guide ensures comprehensive validation of the camera functionality across real-world usage scenarios that automated tests cannot cover.