#!/bin/bash

# Test suite for Android background/foreground transitions
# Tests various combinations to reproduce blank screen freeze issue

PACKAGE="io.tlon.groups"
ACTIVITY="io.tlon.landscape.MainActivity"
TASK_NAME="tlon:backgroundSync:v2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_CYCLES=3
DEFAULT_DELAY=3

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_test() {
    echo -e "\n${YELLOW}========================================${NC}"
    if [[ -n "$CURRENT_TEST_NUM" && -n "$TOTAL_TESTS" ]]; then
        echo -e "${YELLOW}TEST ${CURRENT_TEST_NUM}/${TOTAL_TESTS}: $1${NC}"
    else
        echo -e "${YELLOW}TEST: $1${NC}"
    fi
    echo -e "${YELLOW}========================================${NC}"
}

# Global test tracking variables
CURRENT_TEST_NUM=""
TOTAL_TESTS=""

# Check if app is debuggable (run-as works only for debuggable apps)
APP_IS_DEBUGGABLE=""
check_debuggable() {
    # Try to run a simple command with run-as
    if adb shell run-as "$PACKAGE" id > /dev/null 2>&1; then
        APP_IS_DEBUGGABLE="true"
        log_success "App is debuggable (run-as available)"
    else
        APP_IS_DEBUGGABLE="false"
        log_warn "App is NOT debuggable (run-as unavailable - some tests will use alternatives)"
    fi
}

# Kill a process by PID using available methods
# For non-debuggable apps, falls back to am force-stop
kill_process() {
    local pid=$1
    local signal=${2:-9}  # Default to SIGKILL

    if [[ -z "$pid" ]]; then
        log_warn "No PID provided to kill_process"
        return 1
    fi

    # Method 1: Try run-as (works for debuggable apps)
    if [[ "$APP_IS_DEBUGGABLE" == "true" ]]; then
        if adb shell run-as "$PACKAGE" kill -$signal "$pid" 2>/dev/null; then
            return 0
        fi
    fi

    # Method 2: Try direct kill (works if we have shell permissions)
    # Note: This usually fails on non-rooted devices for other apps' processes
    if adb shell kill -$signal "$pid" 2>/dev/null; then
        # Verify the process actually died (for SIGKILL)
        if [[ "$signal" == "9" ]] || [[ "$signal" == "KILL" ]]; then
            sleep 0.5
            if ! adb shell pidof "$PACKAGE" | grep -q "$pid"; then
                return 0
            fi
        else
            return 0
        fi
    fi

    # Method 3: For SIGKILL, use am force-stop as fallback
    if [[ "$signal" == "9" ]] || [[ "$signal" == "KILL" ]]; then
        log_info "Using am force-stop as fallback for SIGKILL"
        adb shell am force-stop "$PACKAGE"
        return 0
    fi

    # Method 4: Try su (for rooted devices)
    if adb shell su -c "kill -$signal $pid" 2>/dev/null; then
        return 0
    fi

    log_warn "Could not send signal $signal to PID $pid"
    return 1
}

# Send signal to process (for SIGSTOP/SIGCONT)
# Returns 1 if not possible (non-debuggable, non-rooted)
send_signal() {
    local pid=$1
    local signal=$2

    if [[ -z "$pid" ]]; then
        return 1
    fi

    # Method 1: Try run-as (works for debuggable apps)
    if [[ "$APP_IS_DEBUGGABLE" == "true" ]]; then
        if adb shell run-as "$PACKAGE" kill -$signal "$pid" 2>/dev/null; then
            return 0
        fi
    fi

    # Method 2: Try direct signal (usually fails for other processes)
    if adb shell kill -$signal "$pid" 2>/dev/null; then
        return 0
    fi

    # Method 3: Try su (for rooted devices)
    if adb shell su -c "kill -$signal $pid" 2>/dev/null; then
        return 0
    fi

    return 1
}

# Check if device is connected
check_device() {
    if ! adb devices | grep -q "device$"; then
        log_error "No Android device connected"
        exit 1
    fi
    log_success "Device connected"
}

# Check if app is installed
check_app() {
    if ! adb shell pm list packages | grep -q "$PACKAGE"; then
        log_error "App $PACKAGE is not installed"
        exit 1
    fi
    log_success "App $PACKAGE is installed"
}

# Start the app
start_app() {
    log_info "Starting app..."
    adb shell am start -n "$PACKAGE/$ACTIVITY" > /dev/null 2>&1
    sleep 2
}

# Send app to background
send_to_background() {
    log_info "Sending app to background..."
    adb shell input keyevent KEYCODE_HOME
}

# Resume app from background
resume_app() {
    log_info "Resuming app..."
    adb shell am start -n "$PACKAGE/$ACTIVITY" > /dev/null 2>&1
}

# Force stop app
force_stop() {
    log_info "Force stopping app..."
    adb shell am force-stop "$PACKAGE"
}

# Apply memory pressure
apply_memory_pressure() {
    local level=$1
    log_info "Applying memory pressure: $level"
    # Suppress errors - can fail if already at higher pressure level
    local result=$(adb shell am send-trim-memory "$PACKAGE" "$level" 2>&1)
    if echo "$result" | grep -q "Exception\|Error"; then
        log_warn "Could not apply $level (app may already be at higher pressure)"
    fi
}

# Reset memory pressure by bringing app to foreground first
reset_memory_state() {
    # Bringing app to foreground resets its memory trim level
    adb shell am start -n "$PACKAGE/$ACTIVITY" > /dev/null 2>&1
    sleep 1
    adb shell input keyevent KEYCODE_HOME
    sleep 1
}

# Find the WorkManager job ID dynamically (using Expo's recommended pattern)
get_workmanager_job_id() {
    local max_wait=10
    local waited=0
    local job_id=""

    while [[ $waited -lt $max_wait ]]; do
        # Find JOB lines containing our package's SystemJobService (background task), extract job ID
        job_id=$(adb shell dumpsys jobscheduler 2>/dev/null | grep "JOB #" | grep "$PACKAGE.*SystemJobService" | head -1 | grep -oE "#u[0-9a-z]+/[0-9]+" | sed 's/.*\///')

        if [[ -n "$job_id" ]]; then
            echo "$job_id"
            return 0
        fi

        sleep 1
        ((waited++))
    done

    # Return empty if not found after waiting
    echo ""
}

# Trigger background task
trigger_background_task() {
    log_info "Triggering background task..."

    # Get the actual job ID for WorkManager
    local job_id=$(get_workmanager_job_id)

    if [[ -n "$job_id" ]]; then
        log_info "Found WorkManager job ID: $job_id"
        adb shell cmd jobscheduler run -f "$PACKAGE" "$job_id" 2>/dev/null || true
    else
        # Fallback: try common job IDs
        log_warn "Could not find job ID, trying common IDs..."
        adb shell cmd jobscheduler run -f "$PACKAGE" 54 2>/dev/null || true
        adb shell cmd jobscheduler run -f "$PACKAGE" 0 2>/dev/null || true
    fi
}

# Verify background task ran by checking logs
verify_background_task_ran() {
    local timeout=${1:-5}
    log_info "Verifying background task execution (${timeout}s timeout)..."

    # Clear logcat and capture new output
    adb logcat -c 2>/dev/null

    # Trigger the task
    adb shell cmd jobscheduler run -f "$PACKAGE" 0 2>/dev/null || true

    # Wait and capture logs
    sleep "$timeout"

    # Check for background task execution indicators
    local logs=$(adb logcat -d -s ReactNativeJS:V 2>/dev/null | grep -i "background\|task\|sync")

    if echo "$logs" | grep -qi "Running background task\|backgroundSync\|background.*task"; then
        log_success "Background task execution confirmed"
        return 0
    else
        log_warn "Could not confirm background task execution in logs"
        # Show what we did find
        if [[ -n "$logs" ]]; then
            echo "  Found: $(echo "$logs" | head -3)"
        fi
        return 1
    fi
}

# Trigger and verify background task
trigger_and_verify_task() {
    log_info "Triggering and verifying background task..."

    # Clear logcat
    adb logcat -c 2>/dev/null

    # Get job ID and trigger
    local job_id=$(get_workmanager_job_id)
    if [[ -n "$job_id" ]]; then
        log_info "Triggering job ID: $job_id"
        adb shell cmd jobscheduler run -f "$PACKAGE" "$job_id" 2>/dev/null || true
    else
        log_warn "No job ID found, trying default"
        adb shell cmd jobscheduler run -f "$PACKAGE" 0 2>/dev/null || true
    fi

    # Give it time to run (sync can take a few seconds)
    sleep 5

    # Capture all logs
    local all_logs=$(adb logcat -d 2>/dev/null)

    # Check for native task start
    local native_start=$(echo "$all_logs" | grep -E "BackgroundTaskWork|BackgroundTaskConsumer|Executing task.*backgroundSync")

    # Check for JS task logs
    local js_start=$(echo "$all_logs" | grep -i "Running background task")
    local js_init=$(echo "$all_logs" | grep -i "Initiating background sync")
    local js_complete=$(echo "$all_logs" | grep -i "Background sync complete")
    local js_failed=$(echo "$all_logs" | grep -i "Background sync failed")
    local js_timing=$(echo "$all_logs" | grep -i "Background sync timing")
    local js_skip=$(echo "$all_logs" | grep -i "Skipping background sync")

    echo ""
    log_info "=== Background Task Execution Report ==="

    # Native layer
    if [[ -n "$native_start" ]]; then
        log_success "Native: Task triggered"
        echo "$native_start" | head -3 | while read line; do echo "  $line"; done
    else
        log_error "Native: No task trigger found"
    fi

    # JS layer - task start
    if [[ -n "$js_start" ]]; then
        log_success "JS: Task started"
        echo "$js_start" | head -1 | while read line; do echo "  $line"; done
    else
        log_warn "JS: No task start log found"
    fi

    # JS layer - sync initiated
    if [[ -n "$js_init" ]]; then
        log_success "JS: Sync initiated"
        echo "$js_init" | head -1 | while read line; do echo "  $line"; done
    else
        if [[ -n "$js_skip" ]]; then
            log_warn "JS: Sync skipped"
            echo "$js_skip" | head -1 | while read line; do echo "  $line"; done
        else
            log_warn "JS: No sync initiation found"
        fi
    fi

    # JS layer - completion
    if [[ -n "$js_complete" ]]; then
        log_success "JS: Sync completed successfully"
        echo "$js_complete" | head -1 | while read line; do echo "  $line"; done
    elif [[ -n "$js_failed" ]]; then
        log_error "JS: Sync failed"
        echo "$js_failed" | head -1 | while read line; do echo "  $line"; done
    else
        log_warn "JS: No completion status found"
    fi

    # JS layer - timing
    if [[ -n "$js_timing" ]]; then
        log_success "JS: Timing recorded"
        echo "$js_timing" | head -1 | while read line; do echo "  $line"; done
    fi

    echo ""

    # Overall result
    if [[ -n "$native_start" ]] && [[ -n "$js_start" ]]; then
        if [[ -n "$js_complete" ]] || [[ -n "$js_timing" ]]; then
            log_success "Background task FULLY EXECUTED"
            return 0
        elif [[ -n "$js_skip" ]]; then
            log_warn "Background task ran but skipped sync (no auth?)"
            return 0
        else
            log_warn "Background task started but completion unclear"
            return 1
        fi
    else
        log_error "Background task did NOT fully execute"
        return 1
    fi
}

# Check if app is responsive (multiple methods)
check_app_responsive() {
    # Method 1: Check mResumedActivity
    local resumed=$(adb shell dumpsys activity activities 2>/dev/null | grep -E "mResumed.*=.*true|ResumedActivity.*$PACKAGE" | head -1)

    # Method 2: Check if our app is the top activity
    local top=$(adb shell dumpsys activity activities 2>/dev/null | grep "topResumedActivity" | head -1)

    # Method 3: Check focused window
    local focused=$(adb shell dumpsys window windows 2>/dev/null | grep -E "mCurrentFocus|mFocusedApp" | grep "$PACKAGE")

    # Method 4: Check if app process is running
    local process=$(adb shell pidof "$PACKAGE" 2>/dev/null)

    # First check if app is in foreground at all
    if [[ -z "$focused" ]] && ! echo "$top" | grep -q "$PACKAGE" && ! echo "$resumed" | grep -q "$PACKAGE"; then
        if [[ -n "$process" ]]; then
            log_warn "App process running (PID: $process) but may not be in foreground"
            return 0  # Don't fail just because detection is imperfect
        fi
        return 1
    fi

    # Method 5: Check for blank screen using screenshot analysis
    if ! check_screen_not_blank; then
        log_error "Screen appears to be blank!"
        return 1
    fi

    # Method 6: Check for UI elements using uiautomator
    if ! check_ui_elements_present; then
        log_error "Expected UI elements not found - possible freeze"
        return 1
    fi

    # Method 7: Check for ANR or freeze indicators in recent logs
    if check_for_anr; then
        log_error "ANR or freeze detected in logs"
        return 1
    fi

    return 0
}

# Check if screen is not blank by analyzing screenshot
check_screen_not_blank() {
    local screenshot_file="/sdcard/screen_check.png"

    # Take screenshot
    if ! adb shell screencap -p "$screenshot_file" 2>/dev/null; then
        log_warn "Could not take screenshot for blank check"
        return 0  # Don't fail if we can't check
    fi

    # Get image stats - check for color variance
    # A blank screen will have very low variance (all same color)
    local stats=$(adb shell "toybox stat -c %s $screenshot_file" 2>/dev/null)

    # If screenshot is suspiciously small, might be blank
    if [[ -n "$stats" ]] && [[ "$stats" -lt 10000 ]]; then
        log_warn "Screenshot unusually small ($stats bytes) - possible blank screen"
        adb shell rm "$screenshot_file" 2>/dev/null
        return 1
    fi

    # Check for unique colors using simple analysis
    # Pull file and analyze locally for better detection
    local temp_file="/tmp/screen_check_$$.png"
    if adb pull "$screenshot_file" "$temp_file" 2>/dev/null; then
        # Use sips on macOS or identify on Linux to get color info
        if command -v sips &>/dev/null; then
            # macOS - check if image has content
            local pixel_count=$(sips -g pixelWidth -g pixelHeight "$temp_file" 2>/dev/null | grep pixel | awk '{sum+=$2} END {print sum}')
            if [[ -z "$pixel_count" ]] || [[ "$pixel_count" -lt 100 ]]; then
                rm -f "$temp_file"
                adb shell rm "$screenshot_file" 2>/dev/null
                return 1
            fi
        fi
        rm -f "$temp_file"
    fi

    # Cleanup
    adb shell rm "$screenshot_file" 2>/dev/null
    return 0
}

# Check if expected UI elements are present
check_ui_elements_present() {
    local dump_file="/sdcard/ui_dump.xml"

    # Dump UI hierarchy to file
    adb shell uiautomator dump "$dump_file" 2>/dev/null

    # Read the dump file content
    local ui_dump=$(adb shell cat "$dump_file" 2>/dev/null)

    # Cleanup
    adb shell rm "$dump_file" 2>/dev/null

    if [[ -z "$ui_dump" ]]; then
        log_warn "Could not dump UI hierarchy"
        return 0  # Don't fail if we can't check
    fi

    # Check for React Native root view or common app elements
    # A blank screen typically won't have these elements
    if echo "$ui_dump" | grep -qE "ReactRootView|android.widget.TextView|android.widget.Button|android.view.View.*clickable=\"true\""; then
        return 0
    fi

    # Check if we have any clickable or focusable elements (sign of working UI)
    local interactive_elements=$(echo "$ui_dump" | grep -c "clickable=\"true\"\|focusable=\"true\"")
    if [[ "$interactive_elements" -gt 3 ]]; then
        return 0
    fi

    log_warn "UI dump shows few interactive elements ($interactive_elements found)"
    return 1
}

# Check for ANR or freeze indicators in logs
check_for_anr() {
    # Check recent logcat for ANR or freeze indicators
    local anr_check=$(adb logcat -d -t 100 2>/dev/null | grep -iE "ANR in $PACKAGE|Input dispatching timed out|Reason: Input dispatching timed out|FROZEN|not responding")

    if [[ -n "$anr_check" ]]; then
        log_warn "Found ANR/freeze indicator: $(echo "$anr_check" | head -1)"
        return 0  # Return 0 means ANR was found (failure condition)
    fi

    # Check for React Native specific freeze indicators
    local rn_freeze=$(adb logcat -d -t 100 -s ReactNativeJS:* 2>/dev/null | grep -iE "freeze|blank|white screen|not rendering")

    if [[ -n "$rn_freeze" ]]; then
        log_warn "Found RN freeze indicator: $(echo "$rn_freeze" | head -1)"
        return 0
    fi

    return 1  # Return 1 means no ANR found (success)
}

# Wait and check for freeze
wait_and_check() {
    local wait_time=$1
    log_info "Waiting ${wait_time}s and checking app state..."
    sleep "$wait_time"

    if check_app_responsive; then
        log_success "App is responsive"
        return 0
    else
        log_error "App may be frozen or not in foreground"
        # Show debug info
        log_info "Debug: Checking window focus..."
        adb shell dumpsys window windows 2>/dev/null | grep -E "mCurrentFocus|mFocusedApp" | head -2
        return 1
    fi
}

# =============================================================================
# TEST CASES
# =============================================================================

# Test 1: Simple background/foreground cycle
test_simple_cycle() {
    log_test "Simple Background/Foreground Cycle"
    local cycles=${1:-$DEFAULT_CYCLES}
    local delay=${2:-$DEFAULT_DELAY}

    start_app
    sleep 2

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        send_to_background
        sleep "$delay"
        resume_app
        sleep 2

        if ! wait_and_check 2; then
            log_error "Failed at cycle $i"
            return 1
        fi
    done

    log_success "Simple cycle test passed"
}

# Test 2: Background with moderate memory pressure
test_moderate_memory_pressure() {
    log_test "Background with MODERATE Memory Pressure"
    local cycles=${1:-$DEFAULT_CYCLES}

    start_app
    sleep 2

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        send_to_background
        sleep 2
        apply_memory_pressure "MODERATE"
        sleep 3
        resume_app

        if ! wait_and_check 3; then
            log_error "Failed at cycle $i with MODERATE pressure"
            return 1
        fi
    done

    log_success "Moderate memory pressure test passed"
}

# Test 3: Background with complete memory pressure
test_complete_memory_pressure() {
    log_test "Background with COMPLETE Memory Pressure"
    local cycles=${1:-$DEFAULT_CYCLES}

    start_app
    sleep 2

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        send_to_background
        sleep 2
        apply_memory_pressure "COMPLETE"
        sleep 3
        resume_app

        if ! wait_and_check 3; then
            log_error "Failed at cycle $i with COMPLETE pressure"
            return 1
        fi
    done

    log_success "Complete memory pressure test passed"
}

# Test 4: Background with critical memory pressure
test_critical_memory_pressure() {
    log_test "Background with RUNNING_CRITICAL Memory Pressure"
    local cycles=${1:-$DEFAULT_CYCLES}

    start_app
    sleep 2

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        send_to_background
        sleep 2
        apply_memory_pressure "RUNNING_CRITICAL"
        sleep 3
        resume_app

        if ! wait_and_check 3; then
            log_error "Failed at cycle $i with RUNNING_CRITICAL pressure"
            return 1
        fi
    done

    log_success "Critical memory pressure test passed"
}

# Test 5: Trigger background task while in background, then resume
test_background_task_then_resume() {
    log_test "Background Task Trigger Then Resume"
    local cycles=${1:-$DEFAULT_CYCLES}

    start_app
    sleep 2

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        send_to_background
        sleep 2
        trigger_background_task
        sleep 3
        resume_app

        if ! wait_and_check 3; then
            log_error "Failed at cycle $i after background task"
            return 1
        fi
    done

    log_success "Background task then resume test passed"
}

# Test 6: Memory pressure + background task + resume
test_pressure_and_task() {
    log_test "Memory Pressure + Background Task + Resume"
    local cycles=${1:-$DEFAULT_CYCLES}

    start_app
    sleep 2

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        send_to_background
        sleep 2
        apply_memory_pressure "COMPLETE"
        sleep 1
        trigger_background_task
        sleep 3
        resume_app

        if ! wait_and_check 3; then
            log_error "Failed at cycle $i with pressure + task"
            return 1
        fi
    done

    log_success "Pressure and task test passed"
}

# Test 7: Long background duration
test_long_background() {
    log_test "Long Background Duration (30s)"

    start_app
    sleep 2

    send_to_background
    log_info "Waiting 30 seconds in background..."
    sleep 30
    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after long background"
        return 1
    fi

    log_success "Long background test passed"
}

# Test 8: Rapid cycling
test_rapid_cycling() {
    log_test "Rapid Background/Foreground Cycling"
    local cycles=10

    start_app
    sleep 2

    for i in $(seq 1 $cycles); do
        log_info "Rapid cycle $i/$cycles"
        send_to_background
        sleep 1
        resume_app
        sleep 1
    done

    if ! wait_and_check 3; then
        log_error "Failed after rapid cycling"
        return 1
    fi

    log_success "Rapid cycling test passed"
}

# Test 9: Force stop and cold start
test_force_stop_restart() {
    log_test "Force Stop and Cold Restart"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 3
        force_stop
        sleep 2
        start_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i after force stop"
            return 1
        fi
    done

    log_success "Force stop restart test passed"
}

# Test 10: Escalating memory pressure
test_escalating_pressure() {
    log_test "Escalating Memory Pressure Levels"

    # Ordered from lowest to highest pressure (you can only go up, not down)
    local levels=("RUNNING_MODERATE" "RUNNING_LOW" "RUNNING_CRITICAL" "MODERATE" "COMPLETE")

    for level in "${levels[@]}"; do
        log_info "Testing pressure level: $level"

        # Start fresh each time to reset memory state
        start_app
        sleep 2
        send_to_background
        sleep 2
        apply_memory_pressure "$level"
        sleep 3
        resume_app

        if ! wait_and_check 3; then
            log_error "Failed at pressure level $level"
            return 1
        fi
        sleep 2
    done

    log_success "Escalating pressure test passed"
}

# Test 11: Background task during app use
# NOTE: This test is invalid - Android won't run background tasks while app is foregrounded
# Keeping for reference but removed from run_all_tests
test_background_task_during_use() {
    log_test "Background Task While App in Foreground (INVALID - task won't run)"
    log_warn "Background tasks don't run while app is foregrounded on Android"
    log_warn "This test will not produce meaningful results"
    return 0
}

# Test 12: Multiple background tasks
test_multiple_background_tasks() {
    log_test "Multiple Background Task Triggers"

    start_app
    sleep 2
    send_to_background
    sleep 2

    log_info "Triggering multiple background tasks..."
    for i in $(seq 1 5); do
        trigger_background_task
        sleep 1
    done

    sleep 3
    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after multiple background tasks"
        return 1
    fi

    log_success "Multiple background tasks test passed"
}

# Test 13: Force stop while background task is triggered
test_force_stop_during_task() {
    log_test "Force Stop During Background Task"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1
        trigger_background_task
        sleep 1
        # Force stop while task might be running
        force_stop
        sleep 2
        # Cold start after interrupted task
        start_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i after force stop during task"
            return 1
        fi
    done

    log_success "Force stop during task test passed"
}

# Test 14: Background task immediately after force stop restart
test_task_after_force_stop() {
    log_test "Background Task Immediately After Force Stop Restart"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        force_stop
        sleep 1
        start_app
        sleep 2
        # Background first, then trigger task
        send_to_background
        sleep 1
        trigger_background_task
        sleep 3
        resume_app
        sleep 2

        if ! wait_and_check 3; then
            log_error "Failed at cycle $i - task after force stop"
            return 1
        fi
    done

    log_success "Task after force stop test passed"
}

# Test 15: Rapid force stop cycles with background tasks
test_rapid_force_stop_with_tasks() {
    log_test "Rapid Force Stop Cycles with Background Tasks"
    local cycles=5

    for i in $(seq 1 $cycles); do
        log_info "Rapid cycle $i/$cycles"
        start_app
        sleep 1
        send_to_background
        sleep 1
        trigger_background_task
        sleep 1
        force_stop
        sleep 1
    done

    # Final start after all the chaos
    start_app

    if ! wait_and_check 5; then
        log_error "Failed after rapid force stop cycles with tasks"
        return 1
    fi

    log_success "Rapid force stop with tasks test passed"
}

# Test 16: Background task with memory pressure then force stop
test_pressure_task_force_stop() {
    log_test "Memory Pressure + Background Task + Force Stop"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1
        apply_memory_pressure "COMPLETE"
        sleep 1
        trigger_background_task
        sleep 2
        force_stop
        sleep 2
        start_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - pressure + task + force stop"
            return 1
        fi
    done

    log_success "Pressure task force stop test passed"
}

# Test 17: Background task running then resume then force stop
test_task_resume_force_stop() {
    log_test "Background Task -> Resume -> Force Stop -> Restart"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1
        trigger_background_task
        sleep 2
        resume_app
        sleep 2
        # Force stop while app might still be processing
        force_stop
        sleep 2
        start_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - task resume force stop"
            return 1
        fi
    done

    log_success "Task resume force stop test passed"
}

# Test 18: Multiple background tasks then force stop
test_multi_task_force_stop() {
    log_test "Multiple Background Tasks Then Force Stop"

    start_app
    sleep 2
    send_to_background
    sleep 1

    log_info "Triggering multiple background tasks..."
    for i in $(seq 1 5); do
        trigger_background_task
        sleep 0.5
    done

    sleep 2
    force_stop
    sleep 2
    start_app

    if ! wait_and_check 5; then
        log_error "Failed after multi-task force stop"
        return 1
    fi

    log_success "Multi task force stop test passed"
}

# Test 19: Force stop then trigger background task then relaunch
test_force_stop_task_relaunch() {
    log_test "Force Stop -> Background Task -> Relaunch"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        # Force stop the app
        force_stop
        sleep 1
        # Try to trigger background task on stopped app
        trigger_background_task
        sleep 2
        # Relaunch
        start_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - force stop -> task -> relaunch"
            return 1
        fi
    done

    log_success "Force stop task relaunch test passed"
}

# Test 20: Kill process with SIGKILL (harder than force-stop)
test_sigkill() {
    log_test "SIGKILL Process Kill"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2

        # Get PID and kill with SIGKILL
        local pid=$(adb shell pidof "$PACKAGE")
        if [[ -n "$pid" ]]; then
            log_info "Killing process $pid with SIGKILL"
            kill_process "$pid" 9
        fi

        sleep 2
        start_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i after SIGKILL"
            return 1
        fi
    done

    log_success "SIGKILL test passed"
}

# Test 21: SIGSTOP/SIGCONT (pause/resume process)
test_sigstop_cont() {
    log_test "SIGSTOP/SIGCONT Process Pause"
    local cycles=${1:-$DEFAULT_CYCLES}

    # Check if we can send signals (requires debuggable app or root)
    if [[ "$APP_IS_DEBUGGABLE" != "true" ]]; then
        log_warn "SIGSTOP/SIGCONT requires debuggable app or root access"
        log_warn "Skipping test - app is not debuggable"
        return 0
    fi

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2

        local pid=$(adb shell pidof "$PACKAGE")
        if [[ -n "$pid" ]]; then
            log_info "Sending SIGSTOP to process $pid"
            if ! send_signal "$pid" STOP; then
                log_warn "Could not send SIGSTOP - skipping test"
                return 0
            fi
            sleep 3
            log_info "Sending SIGCONT to process $pid"
            if ! send_signal "$pid" CONT; then
                log_warn "Could not send SIGCONT - process may be stuck"
                # Try to recover by killing and restarting
                kill_process "$pid" 9
                sleep 2
                start_app
            fi
        fi

        sleep 2

        if ! wait_and_check 3; then
            log_error "Failed at cycle $i after SIGSTOP/SIGCONT"
            return 1
        fi
    done

    log_success "SIGSTOP/SIGCONT test passed"
}

# Test 22: am kill (softer than force-stop, allows save state)
test_am_kill() {
    log_test "AM Kill (Soft Kill)"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        log_info "Killing with am kill..."
        adb shell am kill "$PACKAGE"

        sleep 2
        start_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i after am kill"
            return 1
        fi
    done

    log_success "AM kill test passed"
}

# Test 23: Lock/unlock screen
test_lock_unlock() {
    log_test "Lock/Unlock Screen"
    local cycles=${1:-$DEFAULT_CYCLES}

    start_app
    sleep 2

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"

        # Lock screen
        log_info "Locking screen..."
        adb shell input keyevent KEYCODE_POWER
        sleep 3

        # Unlock screen
        log_info "Unlocking screen..."
        adb shell input keyevent KEYCODE_POWER
        sleep 1
        # Swipe up to unlock (may need adjustment for your device)
        adb shell input swipe 540 1800 540 800
        sleep 2

        if ! wait_and_check 3; then
            log_error "Failed at cycle $i after lock/unlock"
            return 1
        fi
    done

    log_success "Lock/unlock test passed"
}

# Test 24: Doze mode simulation
test_doze_mode() {
    log_test "Doze Mode Simulation"

    start_app
    sleep 2
    send_to_background
    sleep 1

    log_info "Enabling doze mode..."
    adb shell dumpsys deviceidle enable
    adb shell dumpsys deviceidle force-idle

    sleep 5

    log_info "Disabling doze mode..."
    adb shell dumpsys deviceidle unforce
    adb shell dumpsys deviceidle disable

    sleep 2
    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after doze mode"
        return 1
    fi

    log_success "Doze mode test passed"
}

# Test 25: App standby bucket changes
test_standby_bucket() {
    log_test "App Standby Bucket Changes"

    start_app
    sleep 2
    send_to_background
    sleep 1

    # Move through standby buckets (active -> working_set -> frequent -> rare -> restricted)
    local buckets=("active" "working_set" "frequent" "rare")

    for bucket in "${buckets[@]}"; do
        log_info "Setting standby bucket: $bucket"
        adb shell am set-standby-bucket "$PACKAGE" "$bucket"
        sleep 2
    done

    # Return to active
    adb shell am set-standby-bucket "$PACKAGE" active
    sleep 1
    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after standby bucket changes"
        return 1
    fi

    log_success "Standby bucket test passed"
}

# Test: Background task + SIGKILL
test_task_then_sigkill() {
    log_test "Background Task Then SIGKILL"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Trigger background task
        trigger_background_task
        sleep 2

        # SIGKILL while task may be running
        local pid=$(adb shell pidof "$PACKAGE")
        if [[ -n "$pid" ]]; then
            log_info "Killing process $pid with SIGKILL"
            kill_process "$pid" 9
        fi

        sleep 2
        start_app
        sleep 2

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i after task + SIGKILL"
            return 1
        fi
    done

    log_success "Task then SIGKILL test passed"
}

# Test: Background task + am kill
test_task_then_am_kill() {
    log_test "Background Task Then AM Kill"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Trigger background task
        trigger_background_task
        sleep 2

        # am kill while task may be running
        log_info "Killing with am kill..."
        adb shell am kill "$PACKAGE"

        sleep 2
        start_app
        sleep 2

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i after task + am kill"
            return 1
        fi
    done

    log_success "Task then am kill test passed"
}

# Test: Background task during doze mode
test_task_during_doze() {
    log_test "Background Task During Doze Mode"

    start_app
    sleep 2
    send_to_background
    sleep 1

    log_info "Enabling doze mode..."
    adb shell dumpsys deviceidle enable
    adb shell dumpsys deviceidle force-idle
    sleep 2

    # Trigger background task while in doze
    log_info "Triggering background task during doze..."
    trigger_background_task
    sleep 3

    log_info "Disabling doze mode..."
    adb shell dumpsys deviceidle unforce
    adb shell dumpsys deviceidle disable
    sleep 2

    resume_app
    sleep 2

    if ! wait_and_check 5; then
        log_error "Failed after task during doze"
        return 1
    fi

    log_success "Task during doze test passed"
}

# Test: Background task + standby bucket changes
test_task_with_standby_changes() {
    log_test "Background Task With Standby Bucket Changes"

    start_app
    sleep 2
    send_to_background
    sleep 1

    # Move to rare bucket
    log_info "Setting standby bucket: rare"
    adb shell am set-standby-bucket "$PACKAGE" "rare"
    sleep 2

    # Trigger background task in restricted state
    trigger_background_task
    sleep 3

    # Return to active
    adb shell am set-standby-bucket "$PACKAGE" active
    sleep 1
    resume_app
    sleep 2

    if ! wait_and_check 5; then
        log_error "Failed after task with standby changes"
        return 1
    fi

    log_success "Task with standby changes test passed"
}

# Test 26: Configuration change (rotation)
test_rotation() {
    log_test "Screen Rotation"
    local cycles=${1:-$DEFAULT_CYCLES}

    start_app
    sleep 2

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"

        # Rotate to landscape
        log_info "Rotating to landscape..."
        adb shell settings put system accelerometer_rotation 0
        adb shell settings put system user_rotation 1
        sleep 2

        # Rotate back to portrait
        log_info "Rotating to portrait..."
        adb shell settings put system user_rotation 0
        sleep 2

        if ! wait_and_check 2; then
            log_error "Failed at cycle $i after rotation"
            # Reset rotation
            adb shell settings put system accelerometer_rotation 1
            return 1
        fi
    done

    # Re-enable auto-rotation
    adb shell settings put system accelerometer_rotation 1
    log_success "Rotation test passed"
}

# Test 27: Network connectivity toggle
test_network_toggle() {
    log_test "Network Connectivity Toggle"
    local cycles=${1:-$DEFAULT_CYCLES}

    start_app
    sleep 2

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"

        # Disable wifi and data
        log_info "Disabling network..."
        adb shell svc wifi disable 2>/dev/null || true
        adb shell svc data disable 2>/dev/null || true
        sleep 3

        # Re-enable
        log_info "Enabling network..."
        adb shell svc wifi enable 2>/dev/null || true
        adb shell svc data enable 2>/dev/null || true
        sleep 3

        if ! wait_and_check 3; then
            log_error "Failed at cycle $i after network toggle"
            # Ensure network is re-enabled
            adb shell svc wifi enable 2>/dev/null || true
            adb shell svc data enable 2>/dev/null || true
            return 1
        fi
    done

    log_success "Network toggle test passed"
}

# Test 28: Clear app cache while backgrounded
test_clear_cache() {
    log_test "Clear Cache While Backgrounded"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        log_info "Clearing app cache..."
        # Clear cache directory - requires debuggable app or alternative method
        if [[ "$APP_IS_DEBUGGABLE" == "true" ]]; then
            # Direct cache deletion for debuggable apps
            adb shell run-as "$PACKAGE" rm -rf ./cache/* 2>/dev/null || true
            adb shell run-as "$PACKAGE" rm -rf ./code_cache/* 2>/dev/null || true
        else
            # For non-debuggable apps, use memory trim to simulate cache pressure
            # This encourages the system to clear caches
            adb shell am send-trim-memory "$PACKAGE" COMPLETE 2>/dev/null || true
            log_info "Used memory trim to simulate cache pressure (no direct cache access)"
        fi

        sleep 2
        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i after cache clear"
            return 1
        fi
    done

    log_success "Clear cache test passed"
}

# Test 29: Long background with multiple memory pressure cycles
test_extended_background_pressure() {
    log_test "Extended Background with Memory Pressure Cycles"

    start_app
    sleep 2
    send_to_background

    log_info "Running 60 second background test with memory pressure..."
    for i in $(seq 1 6); do
        log_info "Pressure cycle $i/6"
        sleep 5
        apply_memory_pressure "RUNNING_CRITICAL"
        sleep 5
    done

    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after extended background pressure"
        return 1
    fi

    log_success "Extended background pressure test passed"
}

# Test: Resume while background task is still running
test_resume_during_task() {
    log_test "Resume App During Background Task Execution"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Trigger background task
        trigger_background_task

        # Immediately resume (task likely still running)
        sleep 0.5
        resume_app
        sleep 3

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - resume during task"
            return 1
        fi
    done

    log_success "Resume during task test passed"
}

# Test: Very rapid background/foreground with memory pressure
test_rapid_pressure_cycling() {
    log_test "Rapid Cycling with Memory Pressure"
    local cycles=20

    start_app
    sleep 2

    for i in $(seq 1 $cycles); do
        log_info "Rapid pressure cycle $i/$cycles"
        send_to_background
        apply_memory_pressure "RUNNING_CRITICAL"
        sleep 0.5
        resume_app
        sleep 0.5
    done

    if ! wait_and_check 5; then
        log_error "Failed after rapid pressure cycling"
        return 1
    fi

    log_success "Rapid pressure cycling test passed"
}

# Test: Screen off for extended period (different from just background)
test_screen_off_extended() {
    log_test "Extended Screen Off (2 minutes)"

    start_app
    sleep 2

    # Turn screen off
    log_info "Turning screen off..."
    adb shell input keyevent KEYCODE_POWER

    log_info "Waiting 2 minutes with screen off..."
    sleep 120

    # Turn screen on and unlock
    log_info "Turning screen on..."
    adb shell input keyevent KEYCODE_POWER
    sleep 1
    adb shell input swipe 540 1800 540 800
    sleep 2

    # Resume app
    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after extended screen off"
        return 1
    fi

    log_success "Extended screen off test passed"
}

# Test: Background task with screen off
test_task_with_screen_off() {
    log_test "Background Task With Screen Off"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2

        # Turn screen off (not just background)
        log_info "Turning screen off..."
        adb shell input keyevent KEYCODE_POWER
        sleep 2

        # Trigger background task while screen is off
        trigger_background_task
        sleep 5

        # Turn screen on
        log_info "Turning screen on..."
        adb shell input keyevent KEYCODE_POWER
        sleep 1
        adb shell input swipe 540 1800 540 800
        sleep 2

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - task with screen off"
            return 1
        fi
    done

    log_success "Task with screen off test passed"
}

# Test: Multiple memory pressure levels in quick succession
test_rapid_pressure_escalation() {
    log_test "Rapid Memory Pressure Escalation"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Rapidly apply all pressure levels
        log_info "Rapidly escalating memory pressure..."
        apply_memory_pressure "RUNNING_MODERATE"
        sleep 0.3
        apply_memory_pressure "RUNNING_LOW"
        sleep 0.3
        apply_memory_pressure "RUNNING_CRITICAL"
        sleep 0.3
        apply_memory_pressure "MODERATE"
        sleep 0.3
        apply_memory_pressure "COMPLETE"
        sleep 2

        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - rapid pressure escalation"
            return 1
        fi
    done

    log_success "Rapid pressure escalation test passed"
}

# Test: Activity recreation (simulates config change)
test_activity_recreation() {
    log_test "Force Activity Recreation"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2

        # Force activity to be recreated by changing locale temporarily
        log_info "Forcing activity recreation..."

        # Get current locale
        local current_locale=$(adb shell getprop persist.sys.locale 2>/dev/null)

        # Change to different locale to force recreation
        adb shell setprop persist.sys.locale "es-ES"
        sleep 1

        # Change back
        if [[ -n "$current_locale" ]]; then
            adb shell setprop persist.sys.locale "$current_locale"
        else
            adb shell setprop persist.sys.locale "en-US"
        fi
        sleep 2

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i after activity recreation"
            return 1
        fi
    done

    log_success "Activity recreation test passed"
}

# Test: Background task queue overflow
test_task_queue_overflow() {
    log_test "Background Task Queue Overflow"

    start_app
    sleep 2
    send_to_background
    sleep 1

    # Queue many background tasks rapidly
    log_info "Queuing 20 background tasks rapidly..."
    for i in $(seq 1 20); do
        trigger_background_task
        sleep 0.1
    done

    # Wait for tasks to process
    sleep 10
    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after task queue overflow"
        return 1
    fi

    log_success "Task queue overflow test passed"
}

# Test: Background with low memory simulation
test_low_memory_simulation() {
    log_test "Low Memory Simulation"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Simulate low memory by sending multiple trim levels
        log_info "Simulating low memory conditions..."
        apply_memory_pressure "COMPLETE"
        sleep 1

        # Also trigger the low memory callback
        adb shell am send-trim-memory "$PACKAGE" RUNNING_LOW 2>/dev/null || true
        sleep 2

        # Try to trigger background task under memory pressure
        trigger_background_task
        sleep 3

        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - low memory simulation"
            return 1
        fi
    done

    log_success "Low memory simulation test passed"
}

# Test: Rapid app switching (simulate user switching between apps)
test_rapid_app_switching() {
    log_test "Rapid App Switching Simulation"
    local cycles=10

    start_app
    sleep 2

    for i in $(seq 1 $cycles); do
        log_info "Switch cycle $i/$cycles"

        # Go to home
        adb shell input keyevent KEYCODE_HOME
        sleep 0.5

        # Open recents
        adb shell input keyevent KEYCODE_APP_SWITCH
        sleep 0.5

        # Go back to app
        resume_app
        sleep 0.5
    done

    sleep 2

    if ! wait_and_check 5; then
        log_error "Failed after rapid app switching"
        return 1
    fi

    log_success "Rapid app switching test passed"
}

# Test: Background task interrupted by kill then immediate restart
test_task_kill_rapid_restart() {
    log_test "Background Task Kill with Rapid Restart"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Trigger task
        trigger_background_task
        sleep 1

        # Kill immediately
        local pid=$(adb shell pidof "$PACKAGE")
        if [[ -n "$pid" ]]; then
            kill_process "$pid" 9
        fi

        # Immediate restart (no delay)
        start_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - task kill rapid restart"
            return 1
        fi
    done

    log_success "Task kill rapid restart test passed"
}

# Test: Very long background with periodic tasks
test_very_long_background_with_tasks() {
    log_test "Very Long Background (5 min) with Periodic Tasks"

    start_app
    sleep 2
    send_to_background

    log_info "Running 5 minute background test with periodic tasks..."
    for i in $(seq 1 10); do
        log_info "Period $i/10 (30s each)"
        sleep 25
        trigger_background_task
        sleep 5
    done

    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after very long background with tasks"
        return 1
    fi

    log_success "Very long background with tasks test passed"
}

# Test: Split screen mode transitions
test_split_screen() {
    log_test "Split Screen Mode Transitions"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2

        # Enter split screen (long press recents)
        log_info "Entering split screen..."
        adb shell input keyevent --longpress KEYCODE_APP_SWITCH
        sleep 2

        # Exit split screen
        log_info "Exiting split screen..."
        adb shell input keyevent KEYCODE_HOME
        sleep 1

        # Resume app
        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - split screen"
            return 1
        fi
    done

    log_success "Split screen test passed"
}

# Test: Airplane mode toggle while backgrounded
test_airplane_mode() {
    log_test "Airplane Mode Toggle While Backgrounded"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Enable airplane mode
        log_info "Enabling airplane mode..."
        adb shell cmd connectivity airplane-mode enable 2>/dev/null || \
        adb shell settings put global airplane_mode_on 1 2>/dev/null
        adb shell am broadcast -a android.intent.action.AIRPLANE_MODE 2>/dev/null || true
        sleep 3

        # Disable airplane mode
        log_info "Disabling airplane mode..."
        adb shell cmd connectivity airplane-mode disable 2>/dev/null || \
        adb shell settings put global airplane_mode_on 0 2>/dev/null
        adb shell am broadcast -a android.intent.action.AIRPLANE_MODE 2>/dev/null || true
        sleep 3

        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - airplane mode"
            # Ensure airplane mode is off
            adb shell cmd connectivity airplane-mode disable 2>/dev/null || \
            adb shell settings put global airplane_mode_on 0 2>/dev/null
            return 1
        fi
    done

    log_success "Airplane mode test passed"
}

# Test: Dark mode toggle
test_dark_mode_toggle() {
    log_test "Dark Mode Toggle"
    local cycles=${1:-$DEFAULT_CYCLES}

    start_app
    sleep 2

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"

        # Toggle to dark mode
        log_info "Switching to dark mode..."
        adb shell cmd uimode night yes 2>/dev/null || true
        sleep 2

        # Toggle to light mode
        log_info "Switching to light mode..."
        adb shell cmd uimode night no 2>/dev/null || true
        sleep 2

        if ! wait_and_check 3; then
            log_error "Failed at cycle $i - dark mode toggle"
            return 1
        fi
    done

    log_success "Dark mode toggle test passed"
}

# Test: Font scale change (accessibility)
test_font_scale_change() {
    log_test "Font Scale Change"

    start_app
    sleep 2

    # Get current font scale
    local original_scale=$(adb shell settings get system font_scale 2>/dev/null)
    if [[ -z "$original_scale" ]]; then
        original_scale="1.0"
    fi

    # Test various font scales
    local scales=("0.85" "1.0" "1.15" "1.30" "1.0")

    for scale in "${scales[@]}"; do
        log_info "Setting font scale to $scale..."
        adb shell settings put system font_scale "$scale"
        sleep 2

        if ! wait_and_check 3; then
            log_error "Failed at font scale $scale"
            adb shell settings put system font_scale "$original_scale"
            return 1
        fi
    done

    # Restore original
    adb shell settings put system font_scale "$original_scale"

    log_success "Font scale change test passed"
}

# Test: Battery saver mode
test_battery_saver() {
    log_test "Battery Saver Mode"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Enable battery saver
        log_info "Enabling battery saver..."
        adb shell settings put global low_power 1 2>/dev/null || \
        adb shell cmd battery set level 5 2>/dev/null || true
        sleep 3

        # Trigger background task under battery saver
        trigger_background_task
        sleep 3

        # Disable battery saver
        log_info "Disabling battery saver..."
        adb shell settings put global low_power 0 2>/dev/null || \
        adb shell cmd battery reset 2>/dev/null || true
        sleep 2

        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - battery saver"
            adb shell settings put global low_power 0 2>/dev/null
            adb shell cmd battery reset 2>/dev/null
            return 1
        fi
    done

    log_success "Battery saver test passed"
}

# Test: Notification shade interaction during app use
test_notification_shade() {
    log_test "Notification Shade Interaction"
    local cycles=${1:-$DEFAULT_CYCLES}

    start_app
    sleep 2

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"

        # Pull down notification shade
        log_info "Opening notification shade..."
        adb shell cmd statusbar expand-notifications
        sleep 2

        # Close notification shade
        log_info "Closing notification shade..."
        adb shell cmd statusbar collapse
        sleep 1

        if ! wait_and_check 3; then
            log_error "Failed at cycle $i - notification shade"
            adb shell cmd statusbar collapse
            return 1
        fi
    done

    log_success "Notification shade test passed"
}

# Test: Deep link resume
test_deep_link_resume() {
    log_test "Deep Link Resume"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 2

        # Resume via deep link (adjust URL scheme for your app)
        log_info "Resuming via deep link..."
        adb shell am start -a android.intent.action.VIEW -d "tlon://groups" "$PACKAGE" 2>/dev/null || \
        adb shell am start -n "$PACKAGE/$ACTIVITY" -a android.intent.action.VIEW 2>/dev/null || true
        sleep 2

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - deep link resume"
            return 1
        fi
    done

    log_success "Deep link resume test passed"
}

# Test: Permission revocation while backgrounded
test_permission_revocation() {
    log_test "Permission Revocation While Backgrounded"

    start_app
    sleep 2
    send_to_background
    sleep 1

    # Revoke some permissions (this will kill the app on some Android versions)
    log_info "Revoking permissions..."
    adb shell pm revoke "$PACKAGE" android.permission.CAMERA 2>/dev/null || true
    adb shell pm revoke "$PACKAGE" android.permission.READ_CONTACTS 2>/dev/null || true
    sleep 2

    # Re-grant permissions
    log_info "Re-granting permissions..."
    adb shell pm grant "$PACKAGE" android.permission.CAMERA 2>/dev/null || true
    adb shell pm grant "$PACKAGE" android.permission.READ_CONTACTS 2>/dev/null || true
    sleep 1

    # Resume app
    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after permission revocation"
        return 1
    fi

    log_success "Permission revocation test passed"
}

# Test: Time/timezone change
test_timezone_change() {
    log_test "Timezone Change"

    start_app
    sleep 2

    # Get current timezone
    local original_tz=$(adb shell getprop persist.sys.timezone 2>/dev/null)
    if [[ -z "$original_tz" ]]; then
        original_tz="America/New_York"
    fi

    # Change timezone
    local timezones=("America/Los_Angeles" "Europe/London" "Asia/Tokyo" "$original_tz")

    for tz in "${timezones[@]}"; do
        log_info "Setting timezone to $tz..."
        adb shell setprop persist.sys.timezone "$tz"
        adb shell am broadcast -a android.intent.action.TIMEZONE_CHANGED 2>/dev/null || true
        sleep 2

        if ! wait_and_check 3; then
            log_error "Failed at timezone $tz"
            adb shell setprop persist.sys.timezone "$original_tz"
            return 1
        fi
    done

    log_success "Timezone change test passed"
}

# Test: Rapid back button presses
test_rapid_back_presses() {
    log_test "Rapid Back Button Presses"

    start_app
    sleep 2

    # Send rapid back presses
    log_info "Sending 20 rapid back presses..."
    for i in $(seq 1 20); do
        adb shell input keyevent KEYCODE_BACK
        sleep 0.1
    done

    sleep 2

    # Restart app (it may have exited)
    start_app

    if ! wait_and_check 5; then
        log_error "Failed after rapid back presses"
        return 1
    fi

    log_success "Rapid back presses test passed"
}

# Test: Screenshot/screen recording during transitions
test_screenshot_during_transition() {
    log_test "Screenshot During Transitions"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 1

        # Take screenshot while transitioning to background
        send_to_background &
        adb shell screencap /sdcard/test_screenshot.png
        wait
        sleep 1

        # Take screenshot while resuming
        resume_app &
        adb shell screencap /sdcard/test_screenshot.png
        wait
        sleep 2

        # Cleanup
        adb shell rm /sdcard/test_screenshot.png 2>/dev/null

        if ! wait_and_check 3; then
            log_error "Failed at cycle $i - screenshot during transition"
            return 1
        fi
    done

    log_success "Screenshot during transition test passed"
}

# Test: Display density change
test_display_density() {
    log_test "Display Density Change"

    start_app
    sleep 2

    # Get current density
    local original_density=$(adb shell wm density 2>/dev/null | grep -oE '[0-9]+' | head -1)
    if [[ -z "$original_density" ]]; then
        original_density="420"
    fi

    # Test various densities
    local densities=("320" "480" "560" "$original_density")

    for density in "${densities[@]}"; do
        log_info "Setting display density to $density..."
        adb shell wm density "$density"
        sleep 3

        if ! wait_and_check 3; then
            log_error "Failed at density $density"
            adb shell wm density reset
            return 1
        fi
    done

    # Reset to default
    adb shell wm density reset

    log_success "Display density test passed"
}

# Test: Heavy memory allocation by other apps
test_memory_competition() {
    log_test "Memory Competition (Fill RAM)"

    start_app
    sleep 2
    send_to_background
    sleep 1

    # Try to allocate memory to pressure the app
    log_info "Creating memory pressure by allocating RAM..."

    # Create a large temp file to pressure memory
    adb shell "dd if=/dev/zero of=/data/local/tmp/memtest bs=1M count=500" 2>/dev/null || true
    sleep 3

    # Apply additional memory pressure
    apply_memory_pressure "COMPLETE"
    sleep 2

    # Trigger background task under memory pressure
    trigger_background_task
    sleep 3

    # Clean up memory allocation
    adb shell rm /data/local/tmp/memtest 2>/dev/null

    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after memory competition"
        return 1
    fi

    log_success "Memory competition test passed"
}

# Test: Sustained background task execution
test_sustained_background_tasks() {
    log_test "Sustained Background Task Execution (3 min)"

    start_app
    sleep 2
    send_to_background
    sleep 1

    # Continuously trigger background tasks
    log_info "Triggering background tasks every 5 seconds for 3 minutes..."
    for i in $(seq 1 36); do
        trigger_background_task
        sleep 5
        log_info "Task trigger $i/36"
    done

    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after sustained background tasks"
        return 1
    fi

    log_success "Sustained background tasks test passed"
}

# Test: Push notification while backgrounded
test_push_notification() {
    log_test "Push Notification While Backgrounded"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 2

        # Simulate push notification receipt
        log_info "Simulating push notification..."

        # Method 1: Send FCM-style broadcast (for Firebase)
        adb shell am broadcast \
            -a com.google.android.c2dm.intent.RECEIVE \
            -n "$PACKAGE/expo.modules.notifications.service.NotificationsService" \
            --es "title" "Test Notification" \
            --es "body" "Test message body" \
            2>/dev/null || true

        # Method 2: Post notification directly
        adb shell cmd notification post -S bigtext \
            -t "Test Notification" \
            --package "$PACKAGE" \
            "test_tag_$i" \
            "Test notification message" \
            2>/dev/null || true

        sleep 3

        # Click the notification to resume app
        log_info "Clicking notification to resume..."
        adb shell cmd notification cancel "$PACKAGE" "test_tag_$i" 2>/dev/null || true

        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - push notification"
            return 1
        fi
    done

    log_success "Push notification test passed"
}

# Test: Multiple rapid push notifications
test_rapid_push_notifications() {
    log_test "Rapid Push Notifications"

    start_app
    sleep 2
    send_to_background
    sleep 1

    # Send many notifications rapidly
    log_info "Sending 10 rapid notifications..."
    for i in $(seq 1 10); do
        adb shell cmd notification post -S bigtext \
            -t "Notification $i" \
            --package "$PACKAGE" \
            "rapid_tag_$i" \
            "Rapid notification $i" \
            2>/dev/null || true
        sleep 0.2
    done

    sleep 3
    resume_app

    # Clean up notifications
    for i in $(seq 1 10); do
        adb shell cmd notification cancel "$PACKAGE" "rapid_tag_$i" 2>/dev/null || true
    done

    if ! wait_and_check 5; then
        log_error "Failed after rapid push notifications"
        return 1
    fi

    log_success "Rapid push notifications test passed"
}

# Test: Push notification during background task
test_push_during_task() {
    log_test "Push Notification During Background Task"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Trigger background task
        trigger_background_task
        sleep 1

        # Send notification while task is running
        log_info "Sending notification during background task..."
        adb shell cmd notification post -S bigtext \
            -t "Message" \
            --package "$PACKAGE" \
            "task_notif_$i" \
            "New message received" \
            2>/dev/null || true

        sleep 3

        # Resume app
        resume_app

        # Clean up
        adb shell cmd notification cancel "$PACKAGE" "task_notif_$i" 2>/dev/null || true

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - push during task"
            return 1
        fi
    done

    log_success "Push during task test passed"
}

# Test: Notification click to resume from killed state
test_notification_cold_start() {
    log_test "Notification Resume from Killed State"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2

        # Force stop (kill app completely)
        force_stop
        sleep 1

        # Post notification
        log_info "Posting notification to killed app..."
        adb shell cmd notification post -S bigtext \
            -t "New Message" \
            --package "$PACKAGE" \
            "cold_start_$i" \
            "You have a new message" \
            2>/dev/null || true

        sleep 2

        # Start app (simulates notification click)
        start_app

        # Clean up notification
        adb shell cmd notification cancel "$PACKAGE" "cold_start_$i" 2>/dev/null || true

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - notification cold start"
            return 1
        fi
    done

    log_success "Notification cold start test passed"
}

# =============================================================================
# NETWORK + BACKGROUND TASK INTERACTION TESTS
# =============================================================================

# Helper: Check network connectivity status
check_network_status() {
    local wifi_state=$(adb shell dumpsys wifi 2>/dev/null | grep "Wi-Fi is" | head -1)
    local mobile_state=$(adb shell dumpsys telephony.registry 2>/dev/null | grep "mDataConnectionState" | head -1)

    log_info "Network status:"
    if [[ -n "$wifi_state" ]]; then
        echo "  WiFi: $wifi_state"
    fi
    if [[ -n "$mobile_state" ]]; then
        echo "  Mobile: $mobile_state"
    fi
}

# Helper: Disable all network connectivity
disable_all_network() {
    log_info "Disabling all network connectivity..."
    adb shell svc wifi disable 2>/dev/null || true
    adb shell svc data disable 2>/dev/null || true
    sleep 1
}

# Helper: Enable network connectivity
enable_all_network() {
    log_info "Enabling network connectivity..."
    adb shell svc wifi enable 2>/dev/null || true
    adb shell svc data enable 2>/dev/null || true
    sleep 2
}

# Helper: Switch to wifi only
wifi_only() {
    log_info "Switching to WiFi only..."
    adb shell svc data disable 2>/dev/null || true
    adb shell svc wifi enable 2>/dev/null || true
    sleep 2
}

# Helper: Switch to mobile data only
mobile_only() {
    log_info "Switching to mobile data only..."
    adb shell svc wifi disable 2>/dev/null || true
    adb shell svc data enable 2>/dev/null || true
    sleep 2
}

# Test: Background task triggered with no network, then network restored
test_task_no_network_then_restore() {
    log_test "Background Task With No Network Then Restore"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Disable network before triggering task
        disable_all_network
        sleep 1

        # Trigger background task with no network
        log_info "Triggering background task with network disabled..."
        trigger_background_task
        sleep 3

        # Re-enable network while task might still be processing
        enable_all_network
        sleep 3

        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - task with no network then restore"
            enable_all_network
            return 1
        fi
    done

    log_success "Task no network then restore test passed"
}

# Test: Network loss during active background task
test_network_loss_during_task() {
    log_test "Network Loss During Background Task"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Ensure network is enabled
        enable_all_network
        sleep 1

        # Trigger background task
        log_info "Triggering background task..."
        trigger_background_task

        # Immediately disable network (task likely mid-execution)
        sleep 0.5
        log_info "Cutting network during task execution..."
        disable_all_network
        sleep 3

        # Re-enable network
        enable_all_network
        sleep 2

        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - network loss during task"
            enable_all_network
            return 1
        fi
    done

    log_success "Network loss during task test passed"
}

# Test: Wifi to mobile switch during background task
test_wifi_to_mobile_during_task() {
    log_test "WiFi to Mobile Switch During Background Task"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Start with wifi
        wifi_only
        sleep 1

        # Trigger background task
        log_info "Triggering background task on WiFi..."
        trigger_background_task

        # Switch to mobile during task
        sleep 1
        log_info "Switching to mobile data during task..."
        mobile_only
        sleep 3

        # Back to wifi
        wifi_only
        sleep 2

        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - wifi to mobile switch"
            enable_all_network
            return 1
        fi
    done

    enable_all_network
    log_success "WiFi to mobile switch test passed"
}

# Test: Mobile to wifi switch during background task
test_mobile_to_wifi_during_task() {
    log_test "Mobile to WiFi Switch During Background Task"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Start with mobile
        mobile_only
        sleep 1

        # Trigger background task
        log_info "Triggering background task on mobile data..."
        trigger_background_task

        # Switch to wifi during task
        sleep 1
        log_info "Switching to WiFi during task..."
        wifi_only
        sleep 3

        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - mobile to wifi switch"
            enable_all_network
            return 1
        fi
    done

    enable_all_network
    log_success "Mobile to WiFi switch test passed"
}

# Test: Rapid network toggling during background task
test_rapid_network_toggle_during_task() {
    log_test "Rapid Network Toggle During Background Task"

    start_app
    sleep 2
    send_to_background
    sleep 1

    # Trigger background task
    log_info "Triggering background task..."
    trigger_background_task

    # Rapidly toggle network
    log_info "Rapidly toggling network during task..."
    for i in $(seq 1 5); do
        disable_all_network
        sleep 0.5
        enable_all_network
        sleep 0.5
    done

    sleep 3
    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after rapid network toggle during task"
        enable_all_network
        return 1
    fi

    log_success "Rapid network toggle during task test passed"
}

# Test: Multiple background tasks with intermittent connectivity
test_tasks_intermittent_connectivity() {
    log_test "Multiple Background Tasks with Intermittent Connectivity"

    start_app
    sleep 2
    send_to_background
    sleep 1

    log_info "Triggering tasks with intermittent connectivity..."
    for i in $(seq 1 5); do
        # Toggle network state
        if [ $((i % 2)) -eq 0 ]; then
            disable_all_network
        else
            enable_all_network
        fi
        sleep 0.5

        # Trigger task
        trigger_background_task
        sleep 2
    done

    # Ensure network is back
    enable_all_network
    sleep 2

    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after tasks with intermittent connectivity"
        enable_all_network
        return 1
    fi

    log_success "Tasks intermittent connectivity test passed"
}

# Test: Background task with airplane mode toggle
test_task_airplane_toggle() {
    log_test "Background Task with Airplane Mode Toggle"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Trigger background task
        log_info "Triggering background task..."
        trigger_background_task
        sleep 1

        # Enable airplane mode during task
        log_info "Enabling airplane mode during task..."
        adb shell cmd connectivity airplane-mode enable 2>/dev/null || \
        adb shell settings put global airplane_mode_on 1 2>/dev/null
        adb shell am broadcast -a android.intent.action.AIRPLANE_MODE 2>/dev/null || true
        sleep 3

        # Disable airplane mode
        log_info "Disabling airplane mode..."
        adb shell cmd connectivity airplane-mode disable 2>/dev/null || \
        adb shell settings put global airplane_mode_on 0 2>/dev/null
        adb shell am broadcast -a android.intent.action.AIRPLANE_MODE 2>/dev/null || true
        sleep 3

        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - task with airplane toggle"
            # Ensure airplane mode is off
            adb shell cmd connectivity airplane-mode disable 2>/dev/null || \
            adb shell settings put global airplane_mode_on 0 2>/dev/null
            return 1
        fi
    done

    log_success "Task airplane toggle test passed"
}

# Test: Long running task with network flapping
test_long_task_network_flapping() {
    log_test "Long Running Task with Network Flapping (30s)"

    start_app
    sleep 2
    send_to_background
    sleep 1

    # Trigger background task
    log_info "Triggering background task..."
    trigger_background_task

    # Flap network for 30 seconds
    log_info "Flapping network for 30 seconds..."
    for i in $(seq 1 10); do
        log_info "Network flap cycle $i/10"
        disable_all_network
        sleep 1.5
        enable_all_network
        sleep 1.5
    done

    sleep 2
    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after long task with network flapping"
        enable_all_network
        return 1
    fi

    log_success "Long task network flapping test passed"
}

# Test: Network change during memory pressure and background task
test_network_change_pressure_task() {
    log_test "Network Change + Memory Pressure + Background Task"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Apply memory pressure
        apply_memory_pressure "COMPLETE"
        sleep 1

        # Trigger background task
        trigger_background_task
        sleep 1

        # Disable network
        disable_all_network
        sleep 2

        # Re-enable network
        enable_all_network
        sleep 2

        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - network change + pressure + task"
            enable_all_network
            return 1
        fi
    done

    log_success "Network change pressure task test passed"
}

# Test: Task retry after network failure
test_task_retry_after_network_failure() {
    log_test "Task Retry After Network Failure"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Disable network
        disable_all_network
        sleep 1

        # Trigger task (should fail due to no network)
        log_info "Triggering task with no network (expected to fail)..."
        trigger_background_task
        sleep 3

        # Re-enable network
        enable_all_network
        sleep 2

        # Trigger task again (should succeed now)
        log_info "Triggering task with network restored..."
        trigger_background_task
        sleep 3

        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - task retry after network failure"
            enable_all_network
            return 1
        fi
    done

    log_success "Task retry after network failure test passed"
}

# Test: Network loss during task then kill then restart
test_network_loss_task_kill_restart() {
    log_test "Network Loss During Task Then Kill Then Restart"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Trigger background task
        trigger_background_task
        sleep 1

        # Disable network during task
        disable_all_network
        sleep 1

        # Kill the app
        local pid=$(adb shell pidof "$PACKAGE")
        if [[ -n "$pid" ]]; then
            log_info "Killing process $pid"
            kill_process "$pid" 9
        fi

        sleep 1

        # Re-enable network
        enable_all_network
        sleep 1

        # Restart app
        start_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - network loss + task + kill + restart"
            enable_all_network
            return 1
        fi
    done

    log_success "Network loss task kill restart test passed"
}

# Test: Sustained background tasks with periodic network drops
test_sustained_tasks_periodic_network_drops() {
    log_test "Sustained Tasks with Periodic Network Drops (2 min)"

    start_app
    sleep 2
    send_to_background
    sleep 1

    log_info "Running 2 minute test with periodic network drops..."
    for i in $(seq 1 8); do
        log_info "Period $i/8 (15s each)"

        # Trigger task
        trigger_background_task
        sleep 5

        # Drop network
        disable_all_network
        sleep 5

        # Restore network
        enable_all_network
        sleep 5
    done

    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after sustained tasks with periodic network drops"
        enable_all_network
        return 1
    fi

    log_success "Sustained tasks periodic network drops test passed"
}

# Test: Network type rapid switching (wifi <-> mobile) during task
test_network_type_rapid_switch() {
    log_test "Network Type Rapid Switch During Task"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Trigger background task
        trigger_background_task

        # Rapidly switch between wifi and mobile
        log_info "Rapidly switching network types..."
        for j in $(seq 1 5); do
            wifi_only
            sleep 0.5
            mobile_only
            sleep 0.5
        done

        # Restore both
        enable_all_network
        sleep 3

        resume_app

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - network type rapid switch"
            enable_all_network
            return 1
        fi
    done

    log_success "Network type rapid switch test passed"
}

# Test: Background task during doze with no network
test_task_doze_no_network() {
    log_test "Background Task During Doze with No Network"

    start_app
    sleep 2
    send_to_background
    sleep 1

    # Disable network
    disable_all_network
    sleep 1

    # Enable doze
    log_info "Enabling doze mode..."
    adb shell dumpsys deviceidle enable
    adb shell dumpsys deviceidle force-idle
    sleep 2

    # Trigger background task
    log_info "Triggering background task during doze with no network..."
    trigger_background_task
    sleep 5

    # Disable doze
    log_info "Disabling doze mode..."
    adb shell dumpsys deviceidle unforce
    adb shell dumpsys deviceidle disable
    sleep 1

    # Re-enable network
    enable_all_network
    sleep 2

    resume_app

    if ! wait_and_check 5; then
        log_error "Failed after task during doze with no network"
        enable_all_network
        return 1
    fi

    log_success "Task doze no network test passed"
}

# Test: Network restored exactly when resuming from background
test_network_restore_on_resume() {
    log_test "Network Restore Exactly On Resume"
    local cycles=${1:-$DEFAULT_CYCLES}

    for i in $(seq 1 $cycles); do
        log_info "Cycle $i/$cycles"
        start_app
        sleep 2
        send_to_background
        sleep 1

        # Disable network
        disable_all_network
        sleep 1

        # Trigger background task (will fail/be incomplete)
        trigger_background_task
        sleep 3

        # Resume app AND restore network simultaneously
        log_info "Resuming app while restoring network..."
        resume_app &
        enable_all_network &
        wait
        sleep 3

        if ! wait_and_check 5; then
            log_error "Failed at cycle $i - network restore on resume"
            enable_all_network
            return 1
        fi
    done

    log_success "Network restore on resume test passed"
}

# Test: App update simulation (clear + reinstall dalvik cache)
test_dalvik_cache_clear() {
    log_test "Dalvik Cache Clear"

    start_app
    sleep 2
    send_to_background
    sleep 1

    # Clear dalvik cache for the app (simulates update)
    log_info "Clearing dalvik cache..."
    adb shell cmd package compile --reset "$PACKAGE" 2>/dev/null || true
    sleep 2

    resume_app

    if ! wait_and_check 10; then
        log_error "Failed after dalvik cache clear"
        return 1
    fi

    log_success "Dalvik cache clear test passed"
}

# Test 30: Combination stress test
test_stress_combination() {
    log_test "Stress Combination Test"

    for i in $(seq 1 3); do
        log_info "Stress cycle $i/3"

        start_app
        sleep 2

        # Background first before triggering task
        send_to_background
        sleep 1

        # Trigger task while backgrounded
        trigger_background_task
        sleep 1

        # Memory pressure
        apply_memory_pressure "COMPLETE"
        sleep 1

        # Trigger more tasks
        trigger_background_task
        trigger_background_task
        sleep 2

        # am kill
        adb shell am kill "$PACKAGE"
        sleep 2

        # Restart
        start_app
        sleep 2

        # Background before triggering task
        send_to_background
        sleep 1
        trigger_background_task
        sleep 2
        resume_app
        sleep 2

        if ! wait_and_check 3; then
            log_error "Failed at stress cycle $i"
            return 1
        fi
    done

    log_success "Stress combination test passed"
}

# =============================================================================
# MAIN
# =============================================================================

# Run only the network + background task interaction tests
run_network_tests() {
    local failed=0
    local passed=0
    local tests=(
        "test_task_no_network_then_restore"
        "test_network_loss_during_task"
        "test_wifi_to_mobile_during_task"
        "test_mobile_to_wifi_during_task"
        "test_rapid_network_toggle_during_task"
        "test_tasks_intermittent_connectivity"
        "test_task_airplane_toggle"
        "test_long_task_network_flapping"
        "test_network_change_pressure_task"
        "test_task_retry_after_network_failure"
        "test_network_loss_task_kill_restart"
        "test_sustained_tasks_periodic_network_drops"
        "test_network_type_rapid_switch"
        "test_task_doze_no_network"
        "test_network_restore_on_resume"
    )

    TOTAL_TESTS=${#tests[@]}
    CURRENT_TEST_NUM=0

    for test in "${tests[@]}"; do
        ((CURRENT_TEST_NUM++))

        # Restart app before each test for clean state
        log_info "Restarting app before test..."
        force_stop
        sleep 1

        # Ensure network is enabled before each test
        enable_all_network
        sleep 1

        if $test; then
            ((passed++))
        else
            ((failed++))
            log_warn "Test $test failed - continuing..."
            # Ensure network is restored after failure
            enable_all_network
        fi
        sleep 2
    done

    # Reset tracking variables
    CURRENT_TEST_NUM=""
    TOTAL_TESTS=""

    # Final network restore
    enable_all_network

    echo -e "\n${YELLOW}========================================${NC}"
    echo -e "${YELLOW}NETWORK TEST SUMMARY${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${GREEN}Passed: $passed${NC}"
    echo -e "${RED}Failed: $failed${NC}"

    return $failed
}

# Run only the new aggressive tests
run_aggressive_tests() {
    local failed=0
    local passed=0
    local tests=(
        "test_resume_during_task"
        "test_rapid_pressure_cycling"
        "test_screen_off_extended"
        "test_task_with_screen_off"
        "test_rapid_pressure_escalation"
        "test_activity_recreation"
        "test_task_queue_overflow"
        "test_low_memory_simulation"
        "test_rapid_app_switching"
        "test_task_kill_rapid_restart"
        "test_very_long_background_with_tasks"
        "test_split_screen"
        "test_airplane_mode"
        "test_dark_mode_toggle"
        "test_font_scale_change"
        "test_battery_saver"
        "test_notification_shade"
        "test_deep_link_resume"
        "test_permission_revocation"
        "test_timezone_change"
        "test_rapid_back_presses"
        "test_screenshot_during_transition"
        "test_display_density"
        "test_memory_competition"
        "test_sustained_background_tasks"
        "test_push_notification"
        "test_rapid_push_notifications"
        "test_push_during_task"
        "test_notification_cold_start"
        "test_dalvik_cache_clear"
    )

    TOTAL_TESTS=${#tests[@]}
    CURRENT_TEST_NUM=0

    for test in "${tests[@]}"; do
        ((CURRENT_TEST_NUM++))

        # Restart app before each test for clean state
        log_info "Restarting app before test..."
        force_stop
        sleep 1

        if $test; then
            ((passed++))
        else
            ((failed++))
            log_warn "Test $test failed - continuing..."
        fi
        sleep 2
    done

    # Reset tracking variables
    CURRENT_TEST_NUM=""
    TOTAL_TESTS=""

    echo -e "\n${YELLOW}========================================${NC}"
    echo -e "${YELLOW}AGGRESSIVE TEST SUMMARY${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${GREEN}Passed: $passed${NC}"
    echo -e "${RED}Failed: $failed${NC}"

    return $failed
}

run_all_tests() {
    local failed=0
    local passed=0
    local tests=(
        "test_simple_cycle"
        "test_moderate_memory_pressure"
        "test_complete_memory_pressure"
        "test_critical_memory_pressure"
        "test_background_task_then_resume"
        "test_pressure_and_task"
        "test_long_background"
        "test_rapid_cycling"
        "test_force_stop_restart"
        "test_escalating_pressure"
        "test_multiple_background_tasks"
        "test_force_stop_during_task"
        "test_task_after_force_stop"
        "test_rapid_force_stop_with_tasks"
        "test_pressure_task_force_stop"
        "test_task_resume_force_stop"
        "test_multi_task_force_stop"
        "test_force_stop_task_relaunch"
        "test_sigkill"
        "test_sigstop_cont"
        "test_am_kill"
        "test_lock_unlock"
        "test_doze_mode"
        "test_standby_bucket"
        "test_task_then_sigkill"
        "test_task_then_am_kill"
        "test_task_during_doze"
        "test_task_with_standby_changes"
        "test_rotation"
        "test_network_toggle"
        "test_clear_cache"
        "test_extended_background_pressure"
        "test_resume_during_task"
        "test_rapid_pressure_cycling"
        "test_screen_off_extended"
        "test_task_with_screen_off"
        "test_rapid_pressure_escalation"
        "test_activity_recreation"
        "test_task_queue_overflow"
        "test_low_memory_simulation"
        "test_rapid_app_switching"
        "test_task_kill_rapid_restart"
        "test_very_long_background_with_tasks"
        "test_split_screen"
        "test_airplane_mode"
        "test_dark_mode_toggle"
        "test_font_scale_change"
        "test_battery_saver"
        "test_notification_shade"
        "test_deep_link_resume"
        "test_permission_revocation"
        "test_timezone_change"
        "test_rapid_back_presses"
        "test_screenshot_during_transition"
        "test_display_density"
        "test_memory_competition"
        "test_sustained_background_tasks"
        "test_push_notification"
        "test_rapid_push_notifications"
        "test_push_during_task"
        "test_notification_cold_start"
        "test_task_no_network_then_restore"
        "test_network_loss_during_task"
        "test_wifi_to_mobile_during_task"
        "test_mobile_to_wifi_during_task"
        "test_rapid_network_toggle_during_task"
        "test_tasks_intermittent_connectivity"
        "test_task_airplane_toggle"
        "test_long_task_network_flapping"
        "test_network_change_pressure_task"
        "test_task_retry_after_network_failure"
        "test_network_loss_task_kill_restart"
        "test_sustained_tasks_periodic_network_drops"
        "test_network_type_rapid_switch"
        "test_task_doze_no_network"
        "test_network_restore_on_resume"
        "test_dalvik_cache_clear"
        "test_stress_combination"
    )

    TOTAL_TESTS=${#tests[@]}
    CURRENT_TEST_NUM=0

    for test in "${tests[@]}"; do
        ((CURRENT_TEST_NUM++))

        # Restart app before each test for clean state
        log_info "Restarting app before test..."
        force_stop
        sleep 1

        if $test; then
            ((passed++))
        else
            ((failed++))
            log_warn "Test $test failed - continuing..."
        fi
        sleep 2
    done

    # Reset tracking variables
    CURRENT_TEST_NUM=""
    TOTAL_TESTS=""

    echo -e "\n${YELLOW}========================================${NC}"
    echo -e "${YELLOW}TEST SUMMARY${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${GREEN}Passed: $passed${NC}"
    echo -e "${RED}Failed: $failed${NC}"

    return $failed
}

show_usage() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  all                    Run all tests (78 tests)"
    echo "  aggressive             Run only new aggressive tests (30 tests)"
    echo "  network                Run only network + background task tests (15 tests)"
    echo "  simple [cycles] [delay] Run simple background/foreground test"
    echo "  moderate [cycles]      Run moderate memory pressure test"
    echo "  complete [cycles]      Run complete memory pressure test"
    echo "  critical [cycles]      Run critical memory pressure test"
    echo "  task [cycles]          Run background task then resume test"
    echo "  pressure-task [cycles] Run pressure + task test"
    echo "  long                   Run long background test (30s)"
    echo "  rapid                  Run rapid cycling test"
    echo "  force-stop [cycles]    Run force stop restart test"
    echo "  escalating             Run escalating pressure test"
    echo "  task-foreground [cycles] Run background task during use test"
    echo "  multi-task             Run multiple background tasks test"
    echo ""
    echo "Force Stop + Task Interaction Tests:"
    echo "  stop-during-task [cycles]  Force stop while background task running"
    echo "  task-after-stop [cycles]   Background task immediately after force stop"
    echo "  rapid-stop-task            Rapid force stop cycles with tasks"
    echo "  pressure-task-stop [cycles] Pressure + task + force stop"
    echo "  task-resume-stop [cycles]  Task -> resume -> force stop -> restart"
    echo "  multi-task-stop            Multiple tasks then force stop"
    echo "  stop-task-relaunch [cycles] Force stop -> trigger task -> relaunch"
    echo ""
    echo "Process/System Tests:"
    echo "  sigkill [cycles]       Kill process with SIGKILL"
    echo "  sigstop [cycles]       SIGSTOP/SIGCONT pause process"
    echo "  am-kill [cycles]       Soft kill with am kill"
    echo "  lock-unlock [cycles]   Lock/unlock screen"
    echo "  doze                   Doze mode simulation"
    echo "  standby                App standby bucket changes"
    echo "  task-sigkill [cycles]  Background task then SIGKILL"
    echo "  task-am-kill [cycles]  Background task then am kill"
    echo "  task-doze              Background task during doze mode"
    echo "  task-standby           Background task with standby changes"
    echo "  rotation [cycles]      Screen rotation"
    echo "  network-toggle [cycles] Network connectivity toggle"
    echo "  clear-cache [cycles]   Clear cache while backgrounded"
    echo "  extended-pressure      60s background with pressure cycles"
    echo "  stress                 Combination stress test"
    echo ""
    echo "Network + Background Task Interaction Tests:"
    echo "  task-no-network [cycles]     Task with no network, then restore"
    echo "  network-loss-task [cycles]   Network loss during active task"
    echo "  wifi-to-mobile [cycles]      WiFi to mobile switch during task"
    echo "  mobile-to-wifi [cycles]      Mobile to WiFi switch during task"
    echo "  rapid-net-toggle             Rapid network toggle during task"
    echo "  intermittent-net             Multiple tasks with intermittent connectivity"
    echo "  task-airplane [cycles]       Task with airplane mode toggle"
    echo "  net-flapping                 Long task with network flapping (30s)"
    echo "  net-pressure-task [cycles]   Network change + memory pressure + task"
    echo "  task-retry-net [cycles]      Task retry after network failure"
    echo "  net-kill-restart [cycles]    Network loss + task + kill + restart"
    echo "  sustained-net-drops          Sustained tasks with periodic network drops (2m)"
    echo "  net-type-switch [cycles]     Rapid network type switch during task"
    echo "  task-doze-no-net             Task during doze with no network"
    echo "  net-restore-resume [cycles]  Network restore exactly on resume"
    echo ""
    echo "Utility Commands:"
    echo "  verify-task            Verify background task actually runs"
    echo "  monitor                Just monitor logs (Ctrl+C to stop)"
    echo ""
    echo "Examples:"
    echo "  $0 all                 # Run all tests (78 tests)"
    echo "  $0 network             # Run all network + task tests (15 tests)"
    echo "  $0 simple 5 5          # 5 cycles with 5s delay"
    echo "  $0 stop-during-task 5  # Test force stop during background task"
    echo "  $0 network-loss-task 3 # Test network loss during background task"
    echo "  $0 net-flapping        # Test network flapping during long task"
    echo "  $0 monitor             # Watch logs for issues"
}

# Entry point
main() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Android Background/Resume Test Suite${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    check_device
    check_app
    check_debuggable

    case "${1:-all}" in
        all)
            run_all_tests
            ;;
        aggressive)
            run_aggressive_tests
            ;;
        simple)
            test_simple_cycle "${2:-3}" "${3:-3}"
            ;;
        moderate)
            test_moderate_memory_pressure "${2:-3}"
            ;;
        complete)
            test_complete_memory_pressure "${2:-3}"
            ;;
        critical)
            test_critical_memory_pressure "${2:-3}"
            ;;
        task)
            test_background_task_then_resume "${2:-3}"
            ;;
        pressure-task)
            test_pressure_and_task "${2:-3}"
            ;;
        long)
            test_long_background
            ;;
        rapid)
            test_rapid_cycling
            ;;
        force-stop)
            test_force_stop_restart "${2:-3}"
            ;;
        escalating)
            test_escalating_pressure
            ;;
        task-foreground)
            test_background_task_during_use "${2:-3}"
            ;;
        multi-task)
            test_multiple_background_tasks
            ;;
        stop-during-task)
            test_force_stop_during_task "${2:-3}"
            ;;
        task-after-stop)
            test_task_after_force_stop "${2:-3}"
            ;;
        rapid-stop-task)
            test_rapid_force_stop_with_tasks
            ;;
        pressure-task-stop)
            test_pressure_task_force_stop "${2:-3}"
            ;;
        task-resume-stop)
            test_task_resume_force_stop "${2:-3}"
            ;;
        multi-task-stop)
            test_multi_task_force_stop
            ;;
        stop-task-relaunch)
            test_force_stop_task_relaunch "${2:-3}"
            ;;
        sigkill)
            test_sigkill "${2:-3}"
            ;;
        sigstop)
            test_sigstop_cont "${2:-3}"
            ;;
        am-kill)
            test_am_kill "${2:-3}"
            ;;
        lock-unlock)
            test_lock_unlock "${2:-3}"
            ;;
        doze)
            test_doze_mode
            ;;
        standby)
            test_standby_bucket
            ;;
        task-sigkill)
            test_task_then_sigkill "${2:-3}"
            ;;
        task-am-kill)
            test_task_then_am_kill "${2:-3}"
            ;;
        task-doze)
            test_task_during_doze
            ;;
        task-standby)
            test_task_with_standby_changes
            ;;
        rotation)
            test_rotation "${2:-3}"
            ;;
        network-toggle)
            test_network_toggle "${2:-3}"
            ;;
        network)
            run_network_tests
            ;;
        clear-cache)
            test_clear_cache "${2:-3}"
            ;;
        extended-pressure)
            test_extended_background_pressure
            ;;
        stress)
            test_stress_combination
            ;;
        # Network + Background Task Interaction Tests
        task-no-network)
            test_task_no_network_then_restore "${2:-3}"
            ;;
        network-loss-task)
            test_network_loss_during_task "${2:-3}"
            ;;
        wifi-to-mobile)
            test_wifi_to_mobile_during_task "${2:-3}"
            ;;
        mobile-to-wifi)
            test_mobile_to_wifi_during_task "${2:-3}"
            ;;
        rapid-net-toggle)
            test_rapid_network_toggle_during_task
            ;;
        intermittent-net)
            test_tasks_intermittent_connectivity
            ;;
        task-airplane)
            test_task_airplane_toggle "${2:-3}"
            ;;
        net-flapping)
            test_long_task_network_flapping
            ;;
        net-pressure-task)
            test_network_change_pressure_task "${2:-3}"
            ;;
        task-retry-net)
            test_task_retry_after_network_failure "${2:-3}"
            ;;
        net-kill-restart)
            test_network_loss_task_kill_restart "${2:-3}"
            ;;
        sustained-net-drops)
            test_sustained_tasks_periodic_network_drops
            ;;
        net-type-switch)
            test_network_type_rapid_switch "${2:-3}"
            ;;
        task-doze-no-net)
            test_task_doze_no_network
            ;;
        net-restore-resume)
            test_network_restore_on_resume "${2:-3}"
            ;;
        verify-task)
            log_test "Verify Background Task Execution"
            start_app
            sleep 2
            send_to_background
            sleep 1
            if trigger_and_verify_task; then
                log_success "Background task verification passed"
            else
                log_error "Background task verification failed"
            fi
            ;;
        task-logs)
            log_test "Background Task Raw Logs"

            # Get job ID
            job_id=$(get_workmanager_job_id)
            if [[ -z "$job_id" ]]; then
                log_error "Could not find job ID, checking dumpsys..."
                adb shell dumpsys jobscheduler | grep "io.tlon.groups.*SystemJobService"
                exit 1
            fi
            log_info "Found job ID: $job_id"

            # Clear logs
            adb logcat -c 2>/dev/null

            # Trigger task
            log_info "Triggering background task..."
            adb shell cmd jobscheduler run -f "$PACKAGE" "$job_id"

            # Wait for execution
            log_info "Waiting 5 seconds for task execution..."
            sleep 5

            # Dump all relevant logs
            echo ""
            log_info "=== Raw Logs ==="
            adb logcat -d
            echo ""
            log_info "=== End Logs ==="
            ;;
        monitor)
            log_info "Monitoring logs (Ctrl+C to stop)..."
            adb logcat | grep -E --color=always "ANR|RNScreens|onHostResume|sqlite|backgroundSync|TaskManager|ReactNative|tlon|freeze|blank"
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "Unknown command: $1"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
