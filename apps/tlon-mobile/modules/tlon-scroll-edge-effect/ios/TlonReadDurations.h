#pragma once

#include <array>
#include <cmath>
#include <cstdint>
#include <memory>
#include <utility>

namespace tlon::read_durations {
// Main-thread, fixed-size diagnostic accounting. Inclusive elapsed spans are
// nested; their totals are not CPU time and must not be added across phases.
enum class Phase { Capture, Query, Exposure };
struct Stats {
  uint64_t count{0};
  double totalMs{0}, maxMs{0}, lastStartedAtMs{0}, lastFinishedAtMs{0}, maxStartedAtMs{0}, maxFinishedAtMs{0};
};
struct State {
  explicit State(double (*clock)()) : clock(clock) {}
  double (*clock)();
  bool enabled{true}, valid{true};
  uint64_t activeSpans{0};
  std::array<Stats, 3> phases{};
};
class Span final {
  std::shared_ptr<State> state_;
  Phase phase_;
  double started_{0};
 public:
  Span(const std::shared_ptr<State> &state, Phase phase) : phase_(phase) {
    // In particular, do not read the clock, allocate, or touch counters when
    // diagnostics are absent. Old session completions cannot update a new one.
    if (!state || !state->enabled || !state->valid) return;
    started_ = state->clock();
    if (!std::isfinite(started_) || started_ < 0 || state->activeSpans >= 9007199254740991ULL) {
      state->valid = false; return;
    }
    state_ = state;
    ++state_->activeSpans;
  }
  Span(const Span &) = delete;
  Span &operator=(const Span &) = delete;
  ~Span() {
    if (!state_) return;
    --state_->activeSpans;
    if (!state_->enabled || !state_->valid) return;
    const double finished = state_->clock();
    const double duration = finished - started_;
    auto &s = state_->phases[static_cast<size_t>(phase_)];
    if (!std::isfinite(finished) || duration < 0 || !std::isfinite(s.totalMs + duration) ||
        s.count >= 9007199254740991ULL) { state_->valid = false; return; }
    ++s.count;
    s.totalMs += duration;
    if (s.count == 1 || duration > s.maxMs) { s.maxMs = duration; s.maxStartedAtMs = started_; s.maxFinishedAtMs = finished; }
    s.lastStartedAtMs = started_;
    s.lastFinishedAtMs = finished;
  }
};
template <typename F>
decltype(auto) query(const std::shared_ptr<State> &state, F &&call) {
  Span span(state, Phase::Query);
  return std::forward<F>(call)();
}
} // namespace tlon::read_durations
